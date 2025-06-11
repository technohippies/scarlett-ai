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
  content;
  content;
  var _tmpl$$5 = /* @__PURE__ */ template(`<svg class="animate-spin h-4 w-4"xmlns=http://www.w3.org/2000/svg fill=none viewBox="0 0 24 24"><circle class=opacity-25 cx=12 cy=12 r=10 stroke=currentColor stroke-width=4></circle><path class=opacity-75 fill=currentColor d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">`), _tmpl$2$3 = /* @__PURE__ */ template(`<span>`), _tmpl$3$2 = /* @__PURE__ */ template(`<button>`);
  const Button = (props) => {
    const [local, others] = splitProps(props, ["variant", "size", "fullWidth", "loading", "leftIcon", "rightIcon", "children", "class", "disabled"]);
    const variant = () => local.variant || "primary";
    const size = () => local.size || "md";
    return (() => {
      var _el$ = _tmpl$3$2();
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
          return _tmpl$$5();
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
          var _el$3 = _tmpl$2$3();
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
  var _tmpl$$4 = /* @__PURE__ */ template(`<div><div class=space-y-8>`), _tmpl$2$2 = /* @__PURE__ */ template(`<div>`);
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
      var _el$ = _tmpl$$4(), _el$2 = _el$.firstChild;
      var _ref$ = containerRef;
      typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
      insert(_el$2, createComponent(For, {
        get each() {
          return props.lyrics;
        },
        children: (line, index) => (() => {
          var _el$3 = _tmpl$2$2();
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
  content;
  content;
  content;
  content;
  function createKaraokeAudioProcessor(options) {
    const [audioContext, setAudioContext] = createSignal(null);
    const [mediaStream, setMediaStream] = createSignal(null);
    const [audioWorkletNode, setAudioWorkletNode] = createSignal(null);
    const [isReady, setIsReady] = createSignal(false);
    const [error, setError] = createSignal(null);
    const [isListening, setIsListening] = createSignal(false);
    const [currentRecordingLine, setCurrentRecordingLine] = createSignal(null);
    const [recordedAudioBuffer, setRecordedAudioBuffer] = createSignal([]);
    const [isSessionActive, setIsSessionActive] = createSignal(false);
    const [fullSessionBuffer, setFullSessionBuffer] = createSignal([]);
    const sampleRate = 16e3;
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
        const sample = Math.max(-1, Math.min(1, buffer[i]));
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
  function createKaraokeStore() {
    const [karaokeData, setKaraokeData] = createSignal(null);
    const [currentSession, setCurrentSession] = createSignal(null);
    const [connectionStatus, setConnectionStatus] = createSignal("disconnected");
    const [isKaraokeActive, setIsKaraokeActive] = createSignal(false);
    const [isRecording, setIsRecording] = createSignal(false);
    const [currentRecordingLine, setCurrentRecordingLine] = createSignal();
    const [lineScores, setLineScores] = createSignal(/* @__PURE__ */ new Map());
    const [totalScore, setTotalScore] = createSignal(0);
    const [currentMultiplier, setCurrentMultiplier] = createSignal(1);
    const [streakCount, setStreakCount] = createSignal(0);
    const [completedLines, setCompletedLines] = createSignal(0);
    const [currentWordFeedback, setCurrentWordFeedback] = createSignal(null);
    const performanceScore = createMemo(() => {
      var _a2, _b2;
      const completed = completedLines();
      const total = ((_b2 = (_a2 = karaokeData()) == null ? void 0 : _a2.lyrics) == null ? void 0 : _b2.total_lines) || 0;
      if (completed === 0 || total === 0) return 0;
      const avgScore = totalScore() / completed;
      const completionBonus = completed / total * 20;
      return Math.min(100, avgScore + completionBonus);
    });
    const performanceState = createMemo(() => {
      const score = performanceScore();
      if (score >= 90) return "excellent";
      if (score >= 75) return "good";
      if (score >= 60) return "average";
      return "needs-practice";
    });
    const updateLineScore = (lineIndex, score) => {
      const previousScore = lineScores().get(lineIndex);
      const newLineScores = new Map(lineScores());
      newLineScores.set(lineIndex, score);
      setLineScores(newLineScores);
      const scoreWithMultiplier = Math.round(score.score * currentMultiplier());
      if (!previousScore) {
        setTotalScore((prev) => prev + scoreWithMultiplier);
        setCompletedLines((prev) => prev + 1);
        if (score.score >= 85) {
          setStreakCount((prev) => prev + 1);
          if (streakCount() >= 3) {
            setCurrentMultiplier(Math.min(currentMultiplier() + 0.5, 3));
          }
        } else {
          setStreakCount(0);
          setCurrentMultiplier(1);
        }
      } else {
        const previousScoreWithMultiplier = Math.round(previousScore.score);
        setTotalScore((prev) => prev - previousScoreWithMultiplier + scoreWithMultiplier);
      }
      if (score.wordTimings || score.wordScores) {
        setCurrentWordFeedback({
          wordTimings: score.wordTimings,
          wordScores: score.wordScores
        });
        setTimeout(() => {
          setCurrentWordFeedback(null);
        }, 3e3);
      }
    };
    const resetScoring = () => {
      setLineScores(/* @__PURE__ */ new Map());
      setTotalScore(0);
      setCurrentMultiplier(1);
      setStreakCount(0);
      setCompletedLines(0);
      setCurrentWordFeedback(null);
    };
    return {
      karaokeData,
      setKaraokeData,
      currentSession,
      setCurrentSession,
      connectionStatus,
      setConnectionStatus,
      isKaraokeActive,
      setIsKaraokeActive,
      isRecording,
      setIsRecording,
      currentRecordingLine,
      setCurrentRecordingLine,
      lineScores,
      totalScore,
      currentMultiplier,
      streakCount,
      completedLines,
      performanceScore,
      performanceState,
      currentWordFeedback,
      updateLineScore,
      resetScoring
    };
  }
  content;
  class KaraokeApiService {
    constructor(serverUrl = "http://localhost:8787") {
      this.serverUrl = serverUrl;
    }
    async fetchKaraokeData(trackId, title2, artist) {
      try {
        const url = new URL(`${this.serverUrl}/api/karaoke/${trackId}`);
        if (title2) url.searchParams.set("title", title2);
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
    async startSession(trackId, songData, authToken) {
      try {
        const response = await fetch(`${this.serverUrl}/api/karaoke/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({
            track_id: trackId,
            song_data: songData
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
    async gradeRecording(sessionId, lineIndex, audioData, expectedText, attemptNumber, authToken) {
      try {
        const response = await fetch(`${this.serverUrl}/api/karaoke/grade`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({
            session_id: sessionId,
            line_index: lineIndex,
            audio_data: audioData,
            expected_text: expectedText,
            attempt_number: attemptNumber
          })
        });
        if (response.ok) {
          const result2 = await response.json();
          return {
            score: Math.round(result2.score),
            feedback: result2.feedback,
            attempts: result2.attempts,
            wordTimings: result2.word_timings,
            wordScores: result2.word_scores,
            transcriptionConfidence: result2.transcription_confidence,
            transcript: result2.transcript
          };
        }
        return null;
      } catch (error) {
        console.error("[KaraokeApi] Failed to grade recording:", error);
        return null;
      }
    }
    async completeSession(sessionId, sessionAudioData, lyricsWithTiming, authToken) {
      try {
        const response = await fetch(`${this.serverUrl}/api/karaoke/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({
            session_id: sessionId,
            audio_data: sessionAudioData,
            lyrics_with_timing: lyricsWithTiming
          })
        });
        if (response.ok) {
          return await response.json();
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
          `${this.serverUrl}/api/users/me/songs/${songId}/best-score`,
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
          `${this.serverUrl}/api/songs/${songId}/leaderboard?limit=${limit}`
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
  }
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
    const { startIndex, endIndex } = chunkInfo;
    const line = lines[startIndex];
    if (!line) return 3e3;
    if (endIndex > startIndex) {
      const lastLine = lines[endIndex];
      if (line.recordingStart && lastLine.recordingEnd) {
        return lastLine.recordingEnd - line.recordingStart;
      } else if (endIndex + 1 < lines.length) {
        const nextLine = lines[endIndex + 1];
        return nextLine.timestamp - line.timestamp;
      } else {
        let duration = 0;
        for (let i = startIndex; i <= endIndex; i++) {
          duration += lines[i].duration || 3e3;
        }
        return Math.min(duration, 8e3);
      }
    } else {
      if (line.recordingStart && line.recordingEnd) {
        return line.recordingEnd - line.recordingStart;
      } else if (startIndex + 1 < lines.length) {
        const nextLine = lines[startIndex + 1];
        const calculatedDuration = nextLine.timestamp - line.timestamp;
        return Math.min(Math.max(calculatedDuration, 1e3), 5e3);
      } else {
        return Math.min(line.duration || 3e3, 5e3);
      }
    }
  }
  content;
  var _tmpl$$3 = /* @__PURE__ */ template(`<div>`);
  const Card = (props) => {
    const [local, others] = splitProps(props, ["variant", "padding", "class", "children"]);
    const variant = () => local.variant || "default";
    const padding = () => local.padding || "md";
    return (() => {
      var _el$ = _tmpl$$3();
      spread(_el$, mergeProps({
        get ["class"]() {
          return cn("rounded-xl transition-all", {
            // Variants
            "bg-surface border border-subtle": variant() === "default",
            "bg-transparent border-2 border-default": variant() === "outlined",
            "bg-elevated shadow-xl hover:shadow-2xl hover:translate-y-[-2px]": variant() === "elevated",
            // Padding
            "p-0": padding() === "none",
            "p-3": padding() === "sm",
            "p-6": padding() === "md",
            "p-8": padding() === "lg"
          }, local.class);
        }
      }, others), false);
      insert(_el$, () => local.children);
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$2 = /* @__PURE__ */ template(`<div><div class="h-full bg-accent transition-all duration-300 ease-out rounded-r-sm">`);
  const ProgressBar = (props) => {
    const percentage = () => Math.min(100, Math.max(0, props.current / props.total * 100));
    return (() => {
      var _el$ = _tmpl$$2(), _el$2 = _el$.firstChild;
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
  const header = "_header_j9gju_5";
  const title = "_title_j9gju_9";
  const scoreDisplay = "_scoreDisplay_j9gju_21";
  const grade = "_grade_j9gju_25";
  const newBestScore = "_newBestScore_j9gju_53";
  const lineResult = "_lineResult_j9gju_57";
  const lineText = "_lineText_j9gju_69";
  const lineScore = "_lineScore_j9gju_73";
  const actions = "_actions_j9gju_89";
  const analyzing = "_analyzing_j9gju_93";
  const spinner = "_spinner_j9gju_101";
  const styles = {
    header,
    title,
    scoreDisplay,
    grade,
    newBestScore,
    lineResult,
    lineText,
    lineScore,
    actions,
    analyzing,
    spinner
  };
  var _tmpl$$1 = /* @__PURE__ */ template(`<div><div></div><h2>Analyzing Performance...</h2><p>Processing your vocals and calculating scores`), _tmpl$2$1 = /* @__PURE__ */ template(`<div>`), _tmpl$3$1 = /* @__PURE__ */ template(`<div>🏆 New Personal Best!`), _tmpl$4$1 = /* @__PURE__ */ template(`<div><h2>Performance Complete!`), _tmpl$5$1 = /* @__PURE__ */ template(`<div><h3></h3><p>`), _tmpl$6 = /* @__PURE__ */ template(`<div><div></div><div><span></span><span>/ 100`), _tmpl$7 = /* @__PURE__ */ template(`<p>`), _tmpl$8 = /* @__PURE__ */ template(`<h3>Line Performance`), _tmpl$9 = /* @__PURE__ */ template(`<div><div></div><div><span>%`);
  const KaraokeCompletion = (props) => {
    const getGrade = (score) => {
      if (score >= 95) return "S";
      if (score >= 90) return "A+";
      if (score >= 85) return "A";
      if (score >= 80) return "B+";
      if (score >= 75) return "B";
      if (score >= 70) return "C+";
      if (score >= 65) return "C";
      if (score >= 60) return "D";
      return "F";
    };
    const getGradeColor = (grade22) => {
      switch (grade22) {
        case "S":
          return "#FFD700";
        case "A+":
        case "A":
          return "#4CAF50";
        case "B+":
        case "B":
          return "#2196F3";
        case "C+":
        case "C":
          return "#FF9800";
        case "D":
          return "#F44336";
        case "F":
          return "#9E9E9E";
        default:
          return "#9E9E9E";
      }
    };
    const getFeedback = (score) => {
      if (score >= 95) return "Perfect! You're a karaoke legend! 🌟";
      if (score >= 85) return "Excellent performance! Keep it up! 🎤";
      if (score >= 75) return "Great job! You're getting there! 🎵";
      if (score >= 65) return "Good effort! Practice makes perfect! 🎶";
      if (score >= 55) return "Nice try! Keep practicing! 💪";
      return "Don't give up! Every legend starts somewhere! 🌱";
    };
    const grade2 = () => getGrade(props.overallScore);
    const gradeColor = () => getGradeColor(grade2());
    return (() => {
      var _el$ = _tmpl$2$1();
      insert(_el$, createComponent(Show, {
        get when() {
          return props.isAnalyzing;
        },
        get fallback() {
          return [(() => {
            var _el$4 = _tmpl$4$1(), _el$5 = _el$4.firstChild;
            insert(_el$4, createComponent(Show, {
              get when() {
                return props.isNewBestScore;
              },
              get children() {
                var _el$6 = _tmpl$3$1();
                createRenderEffect(() => className(_el$6, styles.newBestScore));
                return _el$6;
              }
            }), null);
            createRenderEffect((_p$) => {
              var _v$3 = styles.header, _v$4 = styles.title;
              _v$3 !== _p$.e && className(_el$4, _p$.e = _v$3);
              _v$4 !== _p$.t && className(_el$5, _p$.t = _v$4);
              return _p$;
            }, {
              e: void 0,
              t: void 0
            });
            return _el$4;
          })(), createComponent(Card, {
            get ["class"]() {
              return styles.scoreCard;
            },
            get children() {
              return [(() => {
                var _el$7 = _tmpl$5$1(), _el$8 = _el$7.firstChild, _el$9 = _el$8.nextSibling;
                insert(_el$8, () => props.song.title);
                insert(_el$9, () => props.song.artist);
                createRenderEffect(() => className(_el$7, styles.songInfo));
                return _el$7;
              })(), (() => {
                var _el$0 = _tmpl$6(), _el$1 = _el$0.firstChild, _el$10 = _el$1.nextSibling, _el$11 = _el$10.firstChild, _el$12 = _el$11.nextSibling;
                insert(_el$1, grade2);
                insert(_el$11, () => Math.round(props.overallScore));
                createRenderEffect((_p$) => {
                  var _v$5 = styles.scoreDisplay, _v$6 = styles.grade, _v$7 = gradeColor(), _v$8 = styles.score, _v$9 = styles.scoreValue, _v$0 = styles.scoreLabel;
                  _v$5 !== _p$.e && className(_el$0, _p$.e = _v$5);
                  _v$6 !== _p$.t && className(_el$1, _p$.t = _v$6);
                  _v$7 !== _p$.a && ((_p$.a = _v$7) != null ? _el$1.style.setProperty("color", _v$7) : _el$1.style.removeProperty("color"));
                  _v$8 !== _p$.o && className(_el$10, _p$.o = _v$8);
                  _v$9 !== _p$.i && className(_el$11, _p$.i = _v$9);
                  _v$0 !== _p$.n && className(_el$12, _p$.n = _v$0);
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0,
                  a: void 0,
                  o: void 0,
                  i: void 0,
                  n: void 0
                });
                return _el$0;
              })(), (() => {
                var _el$13 = _tmpl$7();
                insert(_el$13, () => getFeedback(props.overallScore));
                createRenderEffect(() => className(_el$13, styles.feedback));
                return _el$13;
              })()];
            }
          }), createComponent(Show, {
            get when() {
              return props.lineResults.length > 0;
            },
            get children() {
              return createComponent(Card, {
                get ["class"]() {
                  return styles.detailsCard;
                },
                get children() {
                  return [(() => {
                    var _el$14 = _tmpl$8();
                    createRenderEffect(() => className(_el$14, styles.detailsTitle));
                    return _el$14;
                  })(), (() => {
                    var _el$15 = _tmpl$2$1();
                    insert(_el$15, createComponent(For, {
                      get each() {
                        return props.lineResults;
                      },
                      children: (line) => (() => {
                        var _el$17 = _tmpl$9(), _el$18 = _el$17.firstChild, _el$19 = _el$18.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$20.firstChild;
                        insert(_el$18, () => line.text);
                        insert(_el$19, createComponent(ProgressBar, {
                          get value() {
                            return line.score;
                          },
                          max: 100,
                          get ["class"]() {
                            return styles.lineProgress;
                          }
                        }), _el$20);
                        insert(_el$20, () => line.score, _el$21);
                        createRenderEffect((_p$) => {
                          var _v$1 = styles.lineResult, _v$10 = styles.lineText, _v$11 = styles.lineScore, _v$12 = styles.lineScoreValue;
                          _v$1 !== _p$.e && className(_el$17, _p$.e = _v$1);
                          _v$10 !== _p$.t && className(_el$18, _p$.t = _v$10);
                          _v$11 !== _p$.a && className(_el$19, _p$.a = _v$11);
                          _v$12 !== _p$.o && className(_el$20, _p$.o = _v$12);
                          return _p$;
                        }, {
                          e: void 0,
                          t: void 0,
                          a: void 0,
                          o: void 0
                        });
                        return _el$17;
                      })()
                    }));
                    createRenderEffect(() => className(_el$15, styles.lineResults));
                    return _el$15;
                  })()];
                }
              });
            }
          }), (() => {
            var _el$16 = _tmpl$2$1();
            insert(_el$16, createComponent(Button, {
              variant: "primary",
              size: "large",
              get onClick() {
                return props.onTryAgain;
              },
              children: "Try Again"
            }));
            createRenderEffect(() => className(_el$16, styles.actions));
            return _el$16;
          })()];
        },
        get children() {
          var _el$2 = _tmpl$$1(), _el$3 = _el$2.firstChild;
          createRenderEffect((_p$) => {
            var _v$ = styles.analyzing, _v$2 = styles.spinner;
            _v$ !== _p$.e && className(_el$2, _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$3, _p$.t = _v$2);
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$2;
        }
      }));
      createRenderEffect(() => className(_el$, styles.completion));
      return _el$;
    })();
  };
  content;
  content;
  const KaraokeSession = (props) => {
    const audioProcessor = createKaraokeAudioProcessor();
    const store = createKaraokeStore();
    const karaokeApi = new KaraokeApiService();
    const [currentAudioTime, setCurrentAudioTime] = createSignal(0);
    const [isAudioPlaying, setIsAudioPlaying] = createSignal(false);
    const [countdownSeconds, setCountdownSeconds] = createSignal();
    const [showCompletion, setShowCompletion] = createSignal(false);
    const [isAnalyzing, setIsAnalyzing] = createSignal(false);
    const [sessionResults, setSessionResults] = createSignal(null);
    const [userBestScore, setUserBestScore] = createSignal();
    const [isNewBestScore, setIsNewBestScore] = createSignal(false);
    const [message, setMessage] = createSignal("");
    const getAudioElement = () => {
      return document.querySelector("#track");
    };
    const connectToServer = async () => {
      var _a2;
      if (store.connectionStatus() === "connecting" || store.connectionStatus() === "connected") {
        return;
      }
      store.setConnectionStatus("connecting");
      setMessage("");
      try {
        const data = await karaokeApi.fetchKaraokeData(props.trackId, props.trackTitle, props.artist);
        if (data) {
          store.setKaraokeData(data);
          if (data.has_karaoke && data.song && ((_a2 = data.lyrics) == null ? void 0 : _a2.type) === "synced") {
            const hasTimedLyrics = data.lyrics.lines.some((line) => line.timestamp !== null);
            if (hasTimedLyrics) {
              store.setConnectionStatus("connected");
              console.log("[KaraokeSession] Karaoke data loaded:", data);
              if (data.song.genius_id && props.authToken) {
                const bestScore = await karaokeApi.getUserBestScore(data.song.genius_id, props.authToken);
                if (bestScore !== null) {
                  setUserBestScore(bestScore);
                }
              }
            } else {
              store.setConnectionStatus("no-karaoke");
              setMessage("This track has lyrics but no synchronized timing for karaoke.");
            }
          } else {
            store.setConnectionStatus("no-karaoke");
            setMessage("No karaoke available for this track.");
          }
        } else {
          throw new Error("Failed to fetch karaoke data");
        }
      } catch (error) {
        console.error("[KaraokeSession] Failed to connect:", error);
        store.setConnectionStatus("disconnected");
        setMessage("Failed to connect to server");
      }
    };
    const handleStartKaraoke = () => {
      setCountdownSeconds(3);
      let count = 3;
      const countdownInterval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(countdownInterval);
          setCountdownSeconds(void 0);
          store.setIsKaraokeActive(true);
          startKaraokeSession();
        } else {
          setCountdownSeconds(count);
        }
      }, 1e3);
    };
    const startKaraokeSession = async () => {
      const data = store.karaokeData();
      if (!data || !data.song || !props.authToken) return;
      if (!audioProcessor.isReady()) {
        await audioProcessor.initialize();
      }
      audioProcessor.startFullSession();
      console.log("[KaraokeSession] Started full session recording");
      const audio = getAudioElement();
      try {
        const session = await karaokeApi.startSession(props.trackId, {
          title: data.song.title,
          artist: data.song.artist,
          genius_id: data.song.genius_id
        }, props.authToken);
        if (session) {
          store.setCurrentSession(session);
          store.resetScoring();
          if (audio && data.song.start_time) {
            audio.currentTime = data.song.start_time;
          }
          if (audio && audio.paused) {
            try {
              await audio.play();
            } catch (error) {
              console.error("[KaraokeSession] Error auto-playing audio:", error);
            }
          }
          console.log("[KaraokeSession] Session started:", session);
        }
      } catch (error) {
        console.error("[KaraokeSession] Error starting session:", error);
        setMessage("Failed to start karaoke. Please try again.");
        store.setIsKaraokeActive(false);
      }
    };
    const handleStartRecording = async (lineIndex) => {
      var _a2;
      if (store.isRecording() || !audioProcessor.isReady() || !props.authToken) return;
      store.setCurrentRecordingLine(lineIndex);
      store.setIsRecording(true);
      try {
        const data = store.karaokeData();
        const lines = ((_a2 = data == null ? void 0 : data.lyrics) == null ? void 0 : _a2.lines) || [];
        const line = lines[lineIndex];
        const chunkInfo = shouldChunkLines(lines, lineIndex);
        const isChunked = chunkInfo.endIndex > lineIndex;
        if (isChunked) {
          console.log(`[KaraokeSession] Chunking lines ${lineIndex}-${chunkInfo.endIndex} (${chunkInfo.wordCount} words)`);
        }
        const lineDuration = calculateRecordingDuration(lines, chunkInfo);
        console.log("[KaraokeSession] Starting recording for line:", lineIndex, "Duration:", lineDuration + "ms");
        audioProcessor.startRecordingLine(lineIndex);
        if (!audioProcessor.isListening()) {
          audioProcessor.startListening();
        }
        setTimeout(async () => {
          console.log("[KaraokeSession] Auto-stopping recording for line:", lineIndex);
          const audioChunks = audioProcessor.stopRecordingLineAndGetRawAudio();
          if (audioChunks.length > 0) {
            const wavBlob = audioProcessor.convertAudioToWavBlob(audioChunks);
            if (wavBlob) {
              const arrayBuffer = await wavBlob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              let binaryString = "";
              const chunkSize = 1024;
              for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.slice(i, i + chunkSize);
                binaryString += String.fromCharCode(...chunk);
              }
              const audioData = btoa(binaryString);
              await submitRecording(lineIndex, audioData, isChunked ? chunkInfo.expectedText : void 0);
              if (isChunked) {
                for (let i = lineIndex + 1; i <= chunkInfo.endIndex; i++) {
                  const mainScore = store.lineScores().get(lineIndex);
                  if (mainScore) {
                    store.updateLineScore(i, mainScore);
                  }
                }
              }
            }
          }
          store.setIsRecording(false);
          store.setCurrentRecordingLine(void 0);
        }, lineDuration + 500);
      } catch (error) {
        console.error("[KaraokeSession] Recording failed:", error);
        store.setIsRecording(false);
      }
    };
    const submitRecording = async (lineIndex, audioData, chunkedText) => {
      var _a2, _b2;
      const session = store.currentSession();
      const data = store.karaokeData();
      if (!session || !((_a2 = data == null ? void 0 : data.lyrics) == null ? void 0 : _a2.lines[lineIndex]) || !props.authToken) return;
      try {
        const score = await karaokeApi.gradeRecording(session.session_id, lineIndex, audioData, chunkedText || data.lyrics.lines[lineIndex].text, (((_b2 = store.lineScores().get(lineIndex)) == null ? void 0 : _b2.attempts) || 0) + 1, props.authToken);
        if (score) {
          store.updateLineScore(lineIndex, score);
          console.log("[KaraokeSession] Line scored:", score);
        }
      } catch (error) {
        console.error("[KaraokeSession] Failed to submit recording:", error);
      }
    };
    const triggerSessionCompletion = async () => {
      var _a2, _b2;
      console.log("[KaraokeSession] Completing session...");
      const audio = getAudioElement();
      if (audio) {
        audio.pause();
      }
      store.setIsKaraokeActive(false);
      const sessionWav = audioProcessor.stopFullSessionAndGetWav();
      if (!sessionWav || !props.authToken) {
        console.error("[KaraokeSession] No session audio or auth token");
        return;
      }
      setIsAnalyzing(true);
      setShowCompletion(true);
      try {
        const reader = new FileReader();
        const audioBase64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = reader.result;
            resolve(base64.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(sessionWav);
        });
        const data = store.karaokeData();
        const session = store.currentSession();
        if (!session) {
          console.error("[KaraokeSession] No active session");
          return;
        }
        const results = await karaokeApi.completeSession(session.session_id, audioBase64, ((_a2 = data == null ? void 0 : data.lyrics) == null ? void 0 : _a2.lines) || [], props.authToken);
        if (results) {
          setSessionResults(results);
          const sessionScore = store.totalScore();
          const currentBestScore = userBestScore() || 0;
          if (sessionScore > currentBestScore) {
            setUserBestScore(sessionScore);
            setIsNewBestScore(true);
          }
          (_b2 = props.onComplete) == null ? void 0 : _b2.call(props, results);
        }
      } catch (error) {
        console.error("[KaraokeSession] Error completing session:", error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    const handleRetryKaraoke = () => {
      setShowCompletion(false);
      setSessionResults(null);
      setIsNewBestScore(false);
      store.resetScoring();
      store.setIsKaraokeActive(false);
      handleStartKaraoke();
    };
    createEffect(() => {
      var _a2, _b2;
      if (!store.isKaraokeActive() || !isAudioPlaying() || store.isRecording()) return;
      const data = store.karaokeData();
      if (!((_a2 = data == null ? void 0 : data.lyrics) == null ? void 0 : _a2.lines)) return;
      const currentTime = currentAudioTime();
      const currentRecording = store.currentRecordingLine();
      let lineToRecord;
      for (let i = 0; i < data.lyrics.lines.length; i++) {
        const line = data.lyrics.lines[i];
        const recordingStart = line.recordingStart || line.timestamp - 300;
        const recordingEnd = line.recordingEnd || ((_b2 = data.lyrics.lines[i + 1]) == null ? void 0 : _b2.timestamp) - 200 || line.timestamp + Math.min(line.duration || 3e3, 5e3);
        if (currentTime >= recordingStart && currentTime < recordingEnd) {
          lineToRecord = i;
          break;
        }
      }
      if (lineToRecord !== void 0 && currentRecording !== lineToRecord && !store.lineScores().has(lineToRecord)) {
        handleStartRecording(lineToRecord);
      }
    });
    onMount(async () => {
      await connectToServer();
      const audio = getAudioElement();
      if (!audio) return;
      const updateTime = () => {
        setCurrentAudioTime(audio.currentTime * 1e3);
        setIsAudioPlaying(!audio.paused);
      };
      const handleTimeUpdate = () => updateTime();
      const handlePlay = () => setIsAudioPlaying(true);
      const handlePause = () => setIsAudioPlaying(false);
      const handleEnded = () => {
        if (store.isKaraokeActive()) {
          triggerSessionCompletion();
        }
      };
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("play", handlePlay);
      audio.addEventListener("pause", handlePause);
      audio.addEventListener("ended", handleEnded);
      updateTime();
      onCleanup(() => {
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("ended", handleEnded);
      });
    });
    return createComponent(Show, {
      get when() {
        return !showCompletion();
      },
      get fallback() {
        return createComponent(KaraokeCompletion, {
          get overallScore() {
            var _a2;
            return ((_a2 = sessionResults()) == null ? void 0 : _a2.overallScore) || store.totalScore();
          },
          get song() {
            var _a2, _b2, _c, _d;
            return {
              title: ((_b2 = (_a2 = store.karaokeData()) == null ? void 0 : _a2.song) == null ? void 0 : _b2.title) || props.trackTitle || "Unknown",
              artist: ((_d = (_c = store.karaokeData()) == null ? void 0 : _c.song) == null ? void 0 : _d.artist) || props.artist || "Unknown"
            };
          },
          get lineResults() {
            var _a2;
            return ((_a2 = sessionResults()) == null ? void 0 : _a2.lineResults) || [];
          },
          get isAnalyzing() {
            return isAnalyzing();
          },
          get isNewBestScore() {
            return isNewBestScore();
          },
          onTryAgain: handleRetryKaraoke
        });
      },
      get children() {
        return createComponent(LyricsDisplay, {
          get lyrics() {
            var _a2, _b2;
            return ((_b2 = (_a2 = store.karaokeData()) == null ? void 0 : _a2.lyrics) == null ? void 0 : _b2.lines.map((line) => ({
              text: line.text,
              startTime: line.timestamp,
              duration: line.duration
            }))) || [];
          },
          get currentTime() {
            return currentAudioTime();
          },
          get isPlaying() {
            return isAudioPlaying();
          },
          get currentRecordingLine() {
            return store.currentRecordingLine();
          },
          get isRecording() {
            return store.isRecording();
          },
          get lineScores() {
            return store.lineScores();
          },
          get performanceState() {
            return store.performanceState();
          },
          get performanceScore() {
            return store.performanceScore();
          },
          get connectionStatus() {
            return store.connectionStatus();
          },
          get isKaraokeActive() {
            return store.isKaraokeActive();
          },
          onStartKaraoke: handleStartKaraoke,
          onRetryConnection: connectToServer,
          get statusMessage() {
            return message();
          },
          get countdownSeconds() {
            return countdownSeconds();
          },
          get difficulty() {
            var _a2, _b2;
            return (_b2 = (_a2 = store.karaokeData()) == null ? void 0 : _a2.song) == null ? void 0 : _b2.difficulty;
          },
          get bestScore() {
            return userBestScore();
          },
          get songId() {
            var _a2, _b2, _c;
            return ((_b2 = (_a2 = store.karaokeData()) == null ? void 0 : _a2.song) == null ? void 0 : _b2.genius_id) || ((_c = store.karaokeData()) == null ? void 0 : _c.track_id);
          }
        });
      }
    });
  };
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
        let title2 = "";
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            title2 = element.textContent.trim();
            break;
          }
        }
        if (!title2) {
          title2 = trackSlug.replace(/-/g, " ");
        }
        const cleanArtist = artist.replace(/-/g, " ").replace(/_/g, " ");
        return {
          trackId: `${artist}/${trackSlug}`,
          title: title2,
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
  var _tmpl$ = /* @__PURE__ */ template(`<span>Scarlett`), _tmpl$2 = /* @__PURE__ */ template(`<div><button title=Minimize>−</button><button title=Close>×`), _tmpl$3 = /* @__PURE__ */ template(`<div>`), _tmpl$4 = /* @__PURE__ */ template(`<button><span>🎤`), _tmpl$5 = /* @__PURE__ */ template(`<div class=karaoke-widget><div><div><span>🎤`);
  const ContentApp = () => {
    console.log("[ContentApp] Rendering ContentApp component");
    const [currentTrack, setCurrentTrack] = createSignal(null);
    const [authToken, setAuthToken] = createSignal(null);
    const [showKaraoke, setShowKaraoke] = createSignal(false);
    const [isMinimized, setIsMinimized] = createSignal(false);
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
        }
      });
      onCleanup(cleanup);
    });
    const handleComplete = (results) => {
      console.log("[ContentApp] Karaoke session completed:", results);
    };
    const handleClose = () => {
      setShowKaraoke(false);
    };
    const handleMinimize = () => {
      setIsMinimized(!isMinimized());
    };
    return createComponent(Show, {
      get when() {
        return memo(() => !!(showKaraoke() && currentTrack()))() && authToken();
      },
      get children() {
        var _el$ = _tmpl$5(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
        _el$.style.setProperty("position", "fixed");
        _el$.style.setProperty("right", "20px");
        _el$.style.setProperty("bottom", "20px");
        _el$.style.setProperty("z-index", "99999");
        _el$.style.setProperty("overflow", "hidden");
        _el$.style.setProperty("border-radius", "16px");
        _el$.style.setProperty("box-shadow", "0 25px 50px -12px rgba(0, 0, 0, 0.6)");
        _el$.style.setProperty("transition", "all 0.3s ease");
        _el$.style.setProperty("background", "#0a0a0a");
        _el$2.style.setProperty("display", "flex");
        _el$2.style.setProperty("justify-content", "space-between");
        _el$2.style.setProperty("align-items", "center");
        _el$2.style.setProperty("padding", "12px 16px");
        _el$2.style.setProperty("background", "#161616");
        _el$2.style.setProperty("border-bottom", "1px solid #262626");
        _el$3.style.setProperty("display", "flex");
        _el$3.style.setProperty("gap", "8px");
        _el$3.style.setProperty("align-items", "center");
        _el$4.style.setProperty("font-size", "20px");
        insert(_el$3, createComponent(Show, {
          get when() {
            return !isMinimized();
          },
          get children() {
            var _el$5 = _tmpl$();
            _el$5.style.setProperty("color", "#fafafa");
            _el$5.style.setProperty("font-weight", "600");
            return _el$5;
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return !isMinimized();
          },
          get children() {
            var _el$6 = _tmpl$2(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling;
            _el$6.style.setProperty("display", "flex");
            _el$6.style.setProperty("gap", "8px");
            _el$7.$$click = handleMinimize;
            _el$7.style.setProperty("background", "none");
            _el$7.style.setProperty("border", "none");
            _el$7.style.setProperty("color", "#a8a8a8");
            _el$7.style.setProperty("cursor", "pointer");
            _el$7.style.setProperty("padding", "4px");
            _el$7.style.setProperty("font-size", "18px");
            _el$8.$$click = handleClose;
            _el$8.style.setProperty("background", "none");
            _el$8.style.setProperty("border", "none");
            _el$8.style.setProperty("color", "#a8a8a8");
            _el$8.style.setProperty("cursor", "pointer");
            _el$8.style.setProperty("padding", "4px");
            _el$8.style.setProperty("font-size", "18px");
            return _el$6;
          }
        }), null);
        insert(_el$, createComponent(Show, {
          get when() {
            return !isMinimized();
          },
          get children() {
            var _el$9 = _tmpl$3();
            _el$9.style.setProperty("height", "calc(100% - 49px)");
            insert(_el$9, createComponent(KaraokeSession, {
              get trackId() {
                return currentTrack().trackId;
              },
              get trackTitle() {
                return currentTrack().title;
              },
              get artist() {
                return currentTrack().artist;
              },
              get authToken() {
                return authToken();
              },
              onComplete: handleComplete
            }));
            return _el$9;
          }
        }), null);
        insert(_el$, createComponent(Show, {
          get when() {
            return isMinimized();
          },
          get children() {
            var _el$0 = _tmpl$4(), _el$1 = _el$0.firstChild;
            _el$0.$$click = handleMinimize;
            _el$0.style.setProperty("width", "100%");
            _el$0.style.setProperty("height", "100%");
            _el$0.style.setProperty("background", "none");
            _el$0.style.setProperty("border", "none");
            _el$0.style.setProperty("cursor", "pointer");
            _el$0.style.setProperty("display", "flex");
            _el$0.style.setProperty("align-items", "center");
            _el$0.style.setProperty("justify-content", "center");
            _el$1.style.setProperty("font-size", "32px");
            return _el$0;
          }
        }), null);
        createRenderEffect((_p$) => {
          var _v$ = isMinimized() ? "auto" : "20px", _v$2 = isMinimized() ? "80px" : "500px", _v$3 = isMinimized() ? "80px" : "auto";
          _v$ !== _p$.e && ((_p$.e = _v$) != null ? _el$.style.setProperty("top", _v$) : _el$.style.removeProperty("top"));
          _v$2 !== _p$.t && ((_p$.t = _v$2) != null ? _el$.style.setProperty("width", _v$2) : _el$.style.removeProperty("width"));
          _v$3 !== _p$.a && ((_p$.a = _v$3) != null ? _el$.style.setProperty("height", _v$3) : _el$.style.removeProperty("height"));
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
        onMount: (container) => {
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
          const unmount = render(() => createComponent(ContentApp, {}), wrapper);
          return unmount;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9zZXJ2aWNlcy9hdWRpby9rYXJhb2tlQXVkaW9Qcm9jZXNzb3IudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc3RvcmVzL2thcmFva2VTdG9yZS50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9zZXJ2aWNlcy9rYXJhb2tlL2thcmFva2VBcGkudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9jaHVua2luZ1V0aWxzLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvY29tbW9uL0NhcmQvQ2FyZC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vUHJvZ3Jlc3NCYXIvUHJvZ3Jlc3NCYXIudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMva2FyYW9rZS9LYXJhb2tlQ29tcGxldGlvbi9LYXJhb2tlQ29tcGxldGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0thcmFva2VTZXNzaW9uL0thcmFva2VTZXNzaW9uLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1ByYWN0aWNlSGVhZGVyL1ByYWN0aWNlSGVhZGVyLnRzeCIsIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvci50cyIsIi4uLy4uLy4uL3NyYy91dGlscy9zdG9yYWdlLnRzIiwiLi4vLi4vLi4vc3JjL2FwcHMvY29udGVudC9Db250ZW50QXBwLnRzeCIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQudHN4IiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImxldCB0YXNrSWRDb3VudGVyID0gMSxcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlLFxuICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2UsXG4gIHRhc2tRdWV1ZSA9IFtdLFxuICBjdXJyZW50VGFzayA9IG51bGwsXG4gIHNob3VsZFlpZWxkVG9Ib3N0ID0gbnVsbCxcbiAgeWllbGRJbnRlcnZhbCA9IDUsXG4gIGRlYWRsaW5lID0gMCxcbiAgbWF4WWllbGRJbnRlcnZhbCA9IDMwMCxcbiAgc2NoZWR1bGVDYWxsYmFjayA9IG51bGwsXG4gIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbmNvbnN0IG1heFNpZ25lZDMxQml0SW50ID0gMTA3Mzc0MTgyMztcbmZ1bmN0aW9uIHNldHVwU2NoZWR1bGVyKCkge1xuICBjb25zdCBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCksXG4gICAgcG9ydCA9IGNoYW5uZWwucG9ydDI7XG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSAoKSA9PiBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9ICgpID0+IHtcbiAgICBpZiAoc2NoZWR1bGVkQ2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBkZWFkbGluZSA9IGN1cnJlbnRUaW1lICsgeWllbGRJbnRlcnZhbDtcbiAgICAgIGNvbnN0IGhhc1RpbWVSZW1haW5pbmcgPSB0cnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaGFzTW9yZVdvcmsgPSBzY2hlZHVsZWRDYWxsYmFjayhoYXNUaW1lUmVtYWluaW5nLCBjdXJyZW50VGltZSk7XG4gICAgICAgIGlmICghaGFzTW9yZVdvcmspIHtcbiAgICAgICAgICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBpZiAobmF2aWdhdG9yICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKSB7XG4gICAgY29uc3Qgc2NoZWR1bGluZyA9IG5hdmlnYXRvci5zY2hlZHVsaW5nO1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGltZSA+PSBkZWFkbGluZSkge1xuICAgICAgICBpZiAoc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZygpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1cnJlbnRUaW1lID49IG1heFlpZWxkSW50ZXJ2YWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHBlcmZvcm1hbmNlLm5vdygpID49IGRlYWRsaW5lO1xuICB9XG59XG5mdW5jdGlvbiBlbnF1ZXVlKHRhc2tRdWV1ZSwgdGFzaykge1xuICBmdW5jdGlvbiBmaW5kSW5kZXgoKSB7XG4gICAgbGV0IG0gPSAwO1xuICAgIGxldCBuID0gdGFza1F1ZXVlLmxlbmd0aCAtIDE7XG4gICAgd2hpbGUgKG0gPD0gbikge1xuICAgICAgY29uc3QgayA9IG4gKyBtID4+IDE7XG4gICAgICBjb25zdCBjbXAgPSB0YXNrLmV4cGlyYXRpb25UaW1lIC0gdGFza1F1ZXVlW2tdLmV4cGlyYXRpb25UaW1lO1xuICAgICAgaWYgKGNtcCA+IDApIG0gPSBrICsgMTtlbHNlIGlmIChjbXAgPCAwKSBuID0gayAtIDE7ZWxzZSByZXR1cm4gaztcbiAgICB9XG4gICAgcmV0dXJuIG07XG4gIH1cbiAgdGFza1F1ZXVlLnNwbGljZShmaW5kSW5kZXgoKSwgMCwgdGFzayk7XG59XG5mdW5jdGlvbiByZXF1ZXN0Q2FsbGJhY2soZm4sIG9wdGlvbnMpIHtcbiAgaWYgKCFzY2hlZHVsZUNhbGxiYWNrKSBzZXR1cFNjaGVkdWxlcigpO1xuICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCksXG4gICAgdGltZW91dCA9IG1heFNpZ25lZDMxQml0SW50O1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnRpbWVvdXQpIHRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQ7XG4gIGNvbnN0IG5ld1Rhc2sgPSB7XG4gICAgaWQ6IHRhc2tJZENvdW50ZXIrKyxcbiAgICBmbixcbiAgICBzdGFydFRpbWUsXG4gICAgZXhwaXJhdGlvblRpbWU6IHN0YXJ0VGltZSArIHRpbWVvdXRcbiAgfTtcbiAgZW5xdWV1ZSh0YXNrUXVldWUsIG5ld1Rhc2spO1xuICBpZiAoIWlzQ2FsbGJhY2tTY2hlZHVsZWQgJiYgIWlzUGVyZm9ybWluZ1dvcmspIHtcbiAgICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBzY2hlZHVsZWRDYWxsYmFjayA9IGZsdXNoV29yaztcbiAgICBzY2hlZHVsZUNhbGxiYWNrKCk7XG4gIH1cbiAgcmV0dXJuIG5ld1Rhc2s7XG59XG5mdW5jdGlvbiBjYW5jZWxDYWxsYmFjayh0YXNrKSB7XG4gIHRhc2suZm4gPSBudWxsO1xufVxuZnVuY3Rpb24gZmx1c2hXb3JrKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZTtcbiAgaXNQZXJmb3JtaW5nV29yayA9IHRydWU7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBjdXJyZW50VGFzayA9IG51bGw7XG4gICAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlO1xuICB9XG59XG5mdW5jdGlvbiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBsZXQgY3VycmVudFRpbWUgPSBpbml0aWFsVGltZTtcbiAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgd2hpbGUgKGN1cnJlbnRUYXNrICE9PSBudWxsKSB7XG4gICAgaWYgKGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lID4gY3VycmVudFRpbWUgJiYgKCFoYXNUaW1lUmVtYWluaW5nIHx8IHNob3VsZFlpZWxkVG9Ib3N0KCkpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgY2FsbGJhY2sgPSBjdXJyZW50VGFzay5mbjtcbiAgICBpZiAoY2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGN1cnJlbnRUYXNrLmZuID0gbnVsbDtcbiAgICAgIGNvbnN0IGRpZFVzZXJDYWxsYmFja1RpbWVvdXQgPSBjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA8PSBjdXJyZW50VGltZTtcbiAgICAgIGNhbGxiYWNrKGRpZFVzZXJDYWxsYmFja1RpbWVvdXQpO1xuICAgICAgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGFzayA9PT0gdGFza1F1ZXVlWzBdKSB7XG4gICAgICAgIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB9XG4gIHJldHVybiBjdXJyZW50VGFzayAhPT0gbnVsbDtcbn1cblxuY29uc3Qgc2hhcmVkQ29uZmlnID0ge1xuICBjb250ZXh0OiB1bmRlZmluZWQsXG4gIHJlZ2lzdHJ5OiB1bmRlZmluZWQsXG4gIGVmZmVjdHM6IHVuZGVmaW5lZCxcbiAgZG9uZTogZmFsc2UsXG4gIGdldENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCk7XG4gIH0sXG4gIGdldE5leHRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQrKyk7XG4gIH1cbn07XG5mdW5jdGlvbiBnZXRDb250ZXh0SWQoY291bnQpIHtcbiAgY29uc3QgbnVtID0gU3RyaW5nKGNvdW50KSxcbiAgICBsZW4gPSBudW0ubGVuZ3RoIC0gMTtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0LmlkICsgKGxlbiA/IFN0cmluZy5mcm9tQ2hhckNvZGUoOTYgKyBsZW4pIDogXCJcIikgKyBudW07XG59XG5mdW5jdGlvbiBzZXRIeWRyYXRlQ29udGV4dChjb250ZXh0KSB7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gY29udGV4dDtcbn1cbmZ1bmN0aW9uIG5leHRIeWRyYXRlQ29udGV4dCgpIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5zaGFyZWRDb25maWcuY29udGV4dCxcbiAgICBpZDogc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSxcbiAgICBjb3VudDogMFxuICB9O1xufVxuXG5jb25zdCBJU19ERVYgPSB0cnVlO1xuY29uc3QgZXF1YWxGbiA9IChhLCBiKSA9PiBhID09PSBiO1xuY29uc3QgJFBST1hZID0gU3ltYm9sKFwic29saWQtcHJveHlcIik7XG5jb25zdCBTVVBQT1JUU19QUk9YWSA9IHR5cGVvZiBQcm94eSA9PT0gXCJmdW5jdGlvblwiO1xuY29uc3QgJFRSQUNLID0gU3ltYm9sKFwic29saWQtdHJhY2tcIik7XG5jb25zdCAkREVWQ09NUCA9IFN5bWJvbChcInNvbGlkLWRldi1jb21wb25lbnRcIik7XG5jb25zdCBzaWduYWxPcHRpb25zID0ge1xuICBlcXVhbHM6IGVxdWFsRm5cbn07XG5sZXQgRVJST1IgPSBudWxsO1xubGV0IHJ1bkVmZmVjdHMgPSBydW5RdWV1ZTtcbmNvbnN0IFNUQUxFID0gMTtcbmNvbnN0IFBFTkRJTkcgPSAyO1xuY29uc3QgVU5PV05FRCA9IHtcbiAgb3duZWQ6IG51bGwsXG4gIGNsZWFudXBzOiBudWxsLFxuICBjb250ZXh0OiBudWxsLFxuICBvd25lcjogbnVsbFxufTtcbmNvbnN0IE5PX0lOSVQgPSB7fTtcbnZhciBPd25lciA9IG51bGw7XG5sZXQgVHJhbnNpdGlvbiA9IG51bGw7XG5sZXQgU2NoZWR1bGVyID0gbnVsbDtcbmxldCBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IG51bGw7XG5sZXQgTGlzdGVuZXIgPSBudWxsO1xubGV0IFVwZGF0ZXMgPSBudWxsO1xubGV0IEVmZmVjdHMgPSBudWxsO1xubGV0IEV4ZWNDb3VudCA9IDA7XG5jb25zdCBEZXZIb29rcyA9IHtcbiAgYWZ0ZXJVcGRhdGU6IG51bGwsXG4gIGFmdGVyQ3JlYXRlT3duZXI6IG51bGwsXG4gIGFmdGVyQ3JlYXRlU2lnbmFsOiBudWxsLFxuICBhZnRlclJlZ2lzdGVyR3JhcGg6IG51bGxcbn07XG5mdW5jdGlvbiBjcmVhdGVSb290KGZuLCBkZXRhY2hlZE93bmVyKSB7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXIsXG4gICAgb3duZXIgPSBPd25lcixcbiAgICB1bm93bmVkID0gZm4ubGVuZ3RoID09PSAwLFxuICAgIGN1cnJlbnQgPSBkZXRhY2hlZE93bmVyID09PSB1bmRlZmluZWQgPyBvd25lciA6IGRldGFjaGVkT3duZXIsXG4gICAgcm9vdCA9IHVub3duZWQgPyB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogbnVsbCxcbiAgICAgIG93bmVyOiBudWxsXG4gICAgfSAgOiB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogY3VycmVudCA/IGN1cnJlbnQuY29udGV4dCA6IG51bGwsXG4gICAgICBvd25lcjogY3VycmVudFxuICAgIH0sXG4gICAgdXBkYXRlRm4gPSB1bm93bmVkID8gKCkgPT4gZm4oKCkgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzcG9zZSBtZXRob2QgbXVzdCBiZSBhbiBleHBsaWNpdCBhcmd1bWVudCB0byBjcmVhdGVSb290IGZ1bmN0aW9uXCIpO1xuICAgIH0pICA6ICgpID0+IGZuKCgpID0+IHVudHJhY2soKCkgPT4gY2xlYW5Ob2RlKHJvb3QpKSk7XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihyb290KTtcbiAgT3duZXIgPSByb290O1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXModXBkYXRlRm4sIHRydWUpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlU2lnbmFsKHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBzID0ge1xuICAgIHZhbHVlLFxuICAgIG9ic2VydmVyczogbnVsbCxcbiAgICBvYnNlcnZlclNsb3RzOiBudWxsLFxuICAgIGNvbXBhcmF0b3I6IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZFxuICB9O1xuICB7XG4gICAgaWYgKG9wdGlvbnMubmFtZSkgcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIGlmIChvcHRpb25zLmludGVybmFsKSB7XG4gICAgICBzLmludGVybmFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVnaXN0ZXJHcmFwaChzKTtcbiAgICAgIGlmIChEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbCkgRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwocyk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHNldHRlciA9IHZhbHVlID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHMpKSB2YWx1ZSA9IHZhbHVlKHMudFZhbHVlKTtlbHNlIHZhbHVlID0gdmFsdWUocy52YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB3cml0ZVNpZ25hbChzLCB2YWx1ZSk7XG4gIH07XG4gIHJldHVybiBbcmVhZFNpZ25hbC5iaW5kKHMpLCBzZXR0ZXJdO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0ZWQoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVuZGVyRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIHJ1bkVmZmVjdHMgPSBydW5Vc2VyRWZmZWN0cztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLnJlbmRlcikgYy51c2VyID0gdHJ1ZTtcbiAgRWZmZWN0cyA/IEVmZmVjdHMucHVzaChjKSA6IHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVhY3Rpb24ob25JbnZhbGlkYXRlLCBvcHRpb25zKSB7XG4gIGxldCBmbjtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICAgIGZuID8gZm4oKSA6IHVudHJhY2sob25JbnZhbGlkYXRlKTtcbiAgICAgIGZuID0gdW5kZWZpbmVkO1xuICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIDAsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBjLnVzZXIgPSB0cnVlO1xuICByZXR1cm4gdHJhY2tpbmcgPT4ge1xuICAgIGZuID0gdHJhY2tpbmc7XG4gICAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIH07XG59XG5mdW5jdGlvbiBjcmVhdGVNZW1vKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgMCwgb3B0aW9ucyApO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMuY29tcGFyYXRvciA9IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZDtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMudFN0YXRlID0gU1RBTEU7XG4gICAgVXBkYXRlcy5wdXNoKGMpO1xuICB9IGVsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiByZWFkU2lnbmFsLmJpbmQoYyk7XG59XG5mdW5jdGlvbiBpc1Byb21pc2Uodikge1xuICByZXR1cm4gdiAmJiB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiAmJiBcInRoZW5cIiBpbiB2O1xufVxuZnVuY3Rpb24gY3JlYXRlUmVzb3VyY2UocFNvdXJjZSwgcEZldGNoZXIsIHBPcHRpb25zKSB7XG4gIGxldCBzb3VyY2U7XG4gIGxldCBmZXRjaGVyO1xuICBsZXQgb3B0aW9ucztcbiAgaWYgKHR5cGVvZiBwRmV0Y2hlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgc291cmNlID0gcFNvdXJjZTtcbiAgICBmZXRjaGVyID0gcEZldGNoZXI7XG4gICAgb3B0aW9ucyA9IHBPcHRpb25zIHx8IHt9O1xuICB9IGVsc2Uge1xuICAgIHNvdXJjZSA9IHRydWU7XG4gICAgZmV0Y2hlciA9IHBTb3VyY2U7XG4gICAgb3B0aW9ucyA9IHBGZXRjaGVyIHx8IHt9O1xuICB9XG4gIGxldCBwciA9IG51bGwsXG4gICAgaW5pdFAgPSBOT19JTklULFxuICAgIGlkID0gbnVsbCxcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZSxcbiAgICBzY2hlZHVsZWQgPSBmYWxzZSxcbiAgICByZXNvbHZlZCA9IFwiaW5pdGlhbFZhbHVlXCIgaW4gb3B0aW9ucyxcbiAgICBkeW5hbWljID0gdHlwZW9mIHNvdXJjZSA9PT0gXCJmdW5jdGlvblwiICYmIGNyZWF0ZU1lbW8oc291cmNlKTtcbiAgY29uc3QgY29udGV4dHMgPSBuZXcgU2V0KCksXG4gICAgW3ZhbHVlLCBzZXRWYWx1ZV0gPSAob3B0aW9ucy5zdG9yYWdlIHx8IGNyZWF0ZVNpZ25hbCkob3B0aW9ucy5pbml0aWFsVmFsdWUpLFxuICAgIFtlcnJvciwgc2V0RXJyb3JdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCksXG4gICAgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KSxcbiAgICBbc3RhdGUsIHNldFN0YXRlXSA9IGNyZWF0ZVNpZ25hbChyZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWQgPSBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xuICAgIGlmIChvcHRpb25zLnNzckxvYWRGcm9tID09PSBcImluaXRpYWxcIikgaW5pdFAgPSBvcHRpb25zLmluaXRpYWxWYWx1ZTtlbHNlIGlmIChzaGFyZWRDb25maWcubG9hZCAmJiBzaGFyZWRDb25maWcuaGFzKGlkKSkgaW5pdFAgPSBzaGFyZWRDb25maWcubG9hZChpZCk7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZEVuZChwLCB2LCBlcnJvciwga2V5KSB7XG4gICAgaWYgKHByID09PSBwKSB7XG4gICAgICBwciA9IG51bGw7XG4gICAgICBrZXkgIT09IHVuZGVmaW5lZCAmJiAocmVzb2x2ZWQgPSB0cnVlKTtcbiAgICAgIGlmICgocCA9PT0gaW5pdFAgfHwgdiA9PT0gaW5pdFApICYmIG9wdGlvbnMub25IeWRyYXRlZCkgcXVldWVNaWNyb3Rhc2soKCkgPT4gb3B0aW9ucy5vbkh5ZHJhdGVkKGtleSwge1xuICAgICAgICB2YWx1ZTogdlxuICAgICAgfSkpO1xuICAgICAgaW5pdFAgPSBOT19JTklUO1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgcCAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIHtcbiAgICAgICAgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocCk7XG4gICAgICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBjb21wbGV0ZUxvYWQodiwgZXJyKSB7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBpZiAoZXJyID09PSB1bmRlZmluZWQpIHNldFZhbHVlKCgpID0+IHYpO1xuICAgICAgc2V0U3RhdGUoZXJyICE9PSB1bmRlZmluZWQgPyBcImVycm9yZWRcIiA6IHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICAgICAgc2V0RXJyb3IoZXJyKTtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBjb250ZXh0cy5rZXlzKCkpIGMuZGVjcmVtZW50KCk7XG4gICAgICBjb250ZXh0cy5jbGVhcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiByZWFkKCkge1xuICAgIGNvbnN0IGMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpLFxuICAgICAgdiA9IHZhbHVlKCksXG4gICAgICBlcnIgPSBlcnJvcigpO1xuICAgIGlmIChlcnIgIT09IHVuZGVmaW5lZCAmJiAhcHIpIHRocm93IGVycjtcbiAgICBpZiAoTGlzdGVuZXIgJiYgIUxpc3RlbmVyLnVzZXIgJiYgYykge1xuICAgICAgY3JlYXRlQ29tcHV0ZWQoKCkgPT4ge1xuICAgICAgICB0cmFjaygpO1xuICAgICAgICBpZiAocHIpIHtcbiAgICAgICAgICBpZiAoYy5yZXNvbHZlZCAmJiBUcmFuc2l0aW9uICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikgVHJhbnNpdGlvbi5wcm9taXNlcy5hZGQocHIpO2Vsc2UgaWYgKCFjb250ZXh0cy5oYXMoYykpIHtcbiAgICAgICAgICAgIGMuaW5jcmVtZW50KCk7XG4gICAgICAgICAgICBjb250ZXh0cy5hZGQoYyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZChyZWZldGNoaW5nID0gdHJ1ZSkge1xuICAgIGlmIChyZWZldGNoaW5nICE9PSBmYWxzZSAmJiBzY2hlZHVsZWQpIHJldHVybjtcbiAgICBzY2hlZHVsZWQgPSBmYWxzZTtcbiAgICBjb25zdCBsb29rdXAgPSBkeW5hbWljID8gZHluYW1pYygpIDogc291cmNlO1xuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgIGlmIChsb29rdXAgPT0gbnVsbCB8fCBsb29rdXAgPT09IGZhbHNlKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bnRyYWNrKHZhbHVlKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChUcmFuc2l0aW9uICYmIHByKSBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwcik7XG4gICAgbGV0IGVycm9yO1xuICAgIGNvbnN0IHAgPSBpbml0UCAhPT0gTk9fSU5JVCA/IGluaXRQIDogdW50cmFjaygoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gZmV0Y2hlcihsb29rdXAsIHtcbiAgICAgICAgICB2YWx1ZTogdmFsdWUoKSxcbiAgICAgICAgICByZWZldGNoaW5nXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZmV0Y2hlckVycm9yKSB7XG4gICAgICAgIGVycm9yID0gZmV0Y2hlckVycm9yO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChlcnJvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlcnJvciksIGxvb2t1cCk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICghaXNQcm9taXNlKHApKSB7XG4gICAgICBsb2FkRW5kKHByLCBwLCB1bmRlZmluZWQsIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgcHIgPSBwO1xuICAgIGlmIChcInZcIiBpbiBwKSB7XG4gICAgICBpZiAocC5zID09PSAxKSBsb2FkRW5kKHByLCBwLnYsIHVuZGVmaW5lZCwgbG9va3VwKTtlbHNlIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKHAudiksIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgc2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiBzY2hlZHVsZWQgPSBmYWxzZSk7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBzZXRTdGF0ZShyZXNvbHZlZCA/IFwicmVmcmVzaGluZ1wiIDogXCJwZW5kaW5nXCIpO1xuICAgICAgdHJpZ2dlcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgICByZXR1cm4gcC50aGVuKHYgPT4gbG9hZEVuZChwLCB2LCB1bmRlZmluZWQsIGxvb2t1cCksIGUgPT4gbG9hZEVuZChwLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlKSwgbG9va3VwKSk7XG4gIH1cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMocmVhZCwge1xuICAgIHN0YXRlOiB7XG4gICAgICBnZXQ6ICgpID0+IHN0YXRlKClcbiAgICB9LFxuICAgIGVycm9yOiB7XG4gICAgICBnZXQ6ICgpID0+IGVycm9yKClcbiAgICB9LFxuICAgIGxvYWRpbmc6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3QgcyA9IHN0YXRlKCk7XG4gICAgICAgIHJldHVybiBzID09PSBcInBlbmRpbmdcIiB8fCBzID09PSBcInJlZnJlc2hpbmdcIjtcbiAgICAgIH1cbiAgICB9LFxuICAgIGxhdGVzdDoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBpZiAoIXJlc29sdmVkKSByZXR1cm4gcmVhZCgpO1xuICAgICAgICBjb25zdCBlcnIgPSBlcnJvcigpO1xuICAgICAgICBpZiAoZXJyICYmICFwcikgdGhyb3cgZXJyO1xuICAgICAgICByZXR1cm4gdmFsdWUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBsZXQgb3duZXIgPSBPd25lcjtcbiAgaWYgKGR5bmFtaWMpIGNyZWF0ZUNvbXB1dGVkKCgpID0+IChvd25lciA9IE93bmVyLCBsb2FkKGZhbHNlKSkpO2Vsc2UgbG9hZChmYWxzZSk7XG4gIHJldHVybiBbcmVhZCwge1xuICAgIHJlZmV0Y2g6IGluZm8gPT4gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBsb2FkKGluZm8pKSxcbiAgICBtdXRhdGU6IHNldFZhbHVlXG4gIH1dO1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWQoc291cmNlLCBvcHRpb25zKSB7XG4gIGxldCB0LFxuICAgIHRpbWVvdXQgPSBvcHRpb25zID8gb3B0aW9ucy50aW1lb3V0TXMgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgaWYgKCF0IHx8ICF0LmZuKSB0ID0gcmVxdWVzdENhbGxiYWNrKCgpID0+IHNldERlZmVycmVkKCgpID0+IG5vZGUudmFsdWUpLCB0aW1lb3V0ICE9PSB1bmRlZmluZWQgPyB7XG4gICAgICB0aW1lb3V0XG4gICAgfSA6IHVuZGVmaW5lZCk7XG4gICAgcmV0dXJuIHNvdXJjZSgpO1xuICB9LCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCBbZGVmZXJyZWQsIHNldERlZmVycmVkXSA9IGNyZWF0ZVNpZ25hbChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCBvcHRpb25zKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHNldERlZmVycmVkKCgpID0+IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICByZXR1cm4gZGVmZXJyZWQ7XG59XG5mdW5jdGlvbiBjcmVhdGVTZWxlY3Rvcihzb3VyY2UsIGZuID0gZXF1YWxGbiwgb3B0aW9ucykge1xuICBjb25zdCBzdWJzID0gbmV3IE1hcCgpO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24ocCA9PiB7XG4gICAgY29uc3QgdiA9IHNvdXJjZSgpO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiBzdWJzLmVudHJpZXMoKSkgaWYgKGZuKGtleSwgdikgIT09IGZuKGtleSwgcCkpIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiB2YWwudmFsdWVzKCkpIHtcbiAgICAgICAgYy5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBpZiAoYy5wdXJlKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSBFZmZlY3RzLnB1c2goYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9LCB1bmRlZmluZWQsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICByZXR1cm4ga2V5ID0+IHtcbiAgICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICAgIGlmIChsaXN0ZW5lcikge1xuICAgICAgbGV0IGw7XG4gICAgICBpZiAobCA9IHN1YnMuZ2V0KGtleSkpIGwuYWRkKGxpc3RlbmVyKTtlbHNlIHN1YnMuc2V0KGtleSwgbCA9IG5ldyBTZXQoW2xpc3RlbmVyXSkpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgbC5kZWxldGUobGlzdGVuZXIpO1xuICAgICAgICAhbC5zaXplICYmIHN1YnMuZGVsZXRlKGtleSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZuKGtleSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIH07XG59XG5mdW5jdGlvbiBiYXRjaChmbikge1xuICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xufVxuZnVuY3Rpb24gdW50cmFjayhmbikge1xuICBpZiAoIUV4dGVybmFsU291cmNlQ29uZmlnICYmIExpc3RlbmVyID09PSBudWxsKSByZXR1cm4gZm4oKTtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykgcmV0dXJuIEV4dGVybmFsU291cmNlQ29uZmlnLnVudHJhY2soZm4pO1xuICAgIHJldHVybiBmbigpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIG9uKGRlcHMsIGZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGRlcHMpO1xuICBsZXQgcHJldklucHV0O1xuICBsZXQgZGVmZXIgPSBvcHRpb25zICYmIG9wdGlvbnMuZGVmZXI7XG4gIHJldHVybiBwcmV2VmFsdWUgPT4ge1xuICAgIGxldCBpbnB1dDtcbiAgICBpZiAoaXNBcnJheSkge1xuICAgICAgaW5wdXQgPSBBcnJheShkZXBzLmxlbmd0aCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlcHMubGVuZ3RoOyBpKyspIGlucHV0W2ldID0gZGVwc1tpXSgpO1xuICAgIH0gZWxzZSBpbnB1dCA9IGRlcHMoKTtcbiAgICBpZiAoZGVmZXIpIHtcbiAgICAgIGRlZmVyID0gZmFsc2U7XG4gICAgICByZXR1cm4gcHJldlZhbHVlO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSB1bnRyYWNrKCgpID0+IGZuKGlucHV0LCBwcmV2SW5wdXQsIHByZXZWYWx1ZSkpO1xuICAgIHByZXZJbnB1dCA9IGlucHV0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5mdW5jdGlvbiBvbk1vdW50KGZuKSB7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB1bnRyYWNrKGZuKSk7XG59XG5mdW5jdGlvbiBvbkNsZWFudXAoZm4pIHtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjbGVhbnVwcyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY2xlYW51cHMgPT09IG51bGwpIE93bmVyLmNsZWFudXBzID0gW2ZuXTtlbHNlIE93bmVyLmNsZWFudXBzLnB1c2goZm4pO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBjYXRjaEVycm9yKGZuLCBoYW5kbGVyKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgT3duZXIgPSBjcmVhdGVDb21wdXRhdGlvbih1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIE93bmVyLmNvbnRleHQgPSB7XG4gICAgLi4uT3duZXIuY29udGV4dCxcbiAgICBbRVJST1JdOiBbaGFuZGxlcl1cbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKE93bmVyKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IE93bmVyLm93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBnZXRMaXN0ZW5lcigpIHtcbiAgcmV0dXJuIExpc3RlbmVyO1xufVxuZnVuY3Rpb24gZ2V0T3duZXIoKSB7XG4gIHJldHVybiBPd25lcjtcbn1cbmZ1bmN0aW9uIHJ1bldpdGhPd25lcihvLCBmbikge1xuICBjb25zdCBwcmV2ID0gT3duZXI7XG4gIGNvbnN0IHByZXZMaXN0ZW5lciA9IExpc3RlbmVyO1xuICBPd25lciA9IG87XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgdHJ1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBwcmV2O1xuICAgIExpc3RlbmVyID0gcHJldkxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBlbmFibGVTY2hlZHVsaW5nKHNjaGVkdWxlciA9IHJlcXVlc3RDYWxsYmFjaykge1xuICBTY2hlZHVsZXIgPSBzY2hlZHVsZXI7XG59XG5mdW5jdGlvbiBzdGFydFRyYW5zaXRpb24oZm4pIHtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgZm4oKTtcbiAgICByZXR1cm4gVHJhbnNpdGlvbi5kb25lO1xuICB9XG4gIGNvbnN0IGwgPSBMaXN0ZW5lcjtcbiAgY29uc3QgbyA9IE93bmVyO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiB7XG4gICAgTGlzdGVuZXIgPSBsO1xuICAgIE93bmVyID0gbztcbiAgICBsZXQgdDtcbiAgICBpZiAoU2NoZWR1bGVyIHx8IFN1c3BlbnNlQ29udGV4dCkge1xuICAgICAgdCA9IFRyYW5zaXRpb24gfHwgKFRyYW5zaXRpb24gPSB7XG4gICAgICAgIHNvdXJjZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZWZmZWN0czogW10sXG4gICAgICAgIHByb21pc2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGRpc3Bvc2VkOiBuZXcgU2V0KCksXG4gICAgICAgIHF1ZXVlOiBuZXcgU2V0KCksXG4gICAgICAgIHJ1bm5pbmc6IHRydWVcbiAgICAgIH0pO1xuICAgICAgdC5kb25lIHx8ICh0LmRvbmUgPSBuZXcgUHJvbWlzZShyZXMgPT4gdC5yZXNvbHZlID0gcmVzKSk7XG4gICAgICB0LnJ1bm5pbmcgPSB0cnVlO1xuICAgIH1cbiAgICBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG4gICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgcmV0dXJuIHQgPyB0LmRvbmUgOiB1bmRlZmluZWQ7XG4gIH0pO1xufVxuY29uc3QgW3RyYW5zUGVuZGluZywgc2V0VHJhbnNQZW5kaW5nXSA9IC8qQF9fUFVSRV9fKi9jcmVhdGVTaWduYWwoZmFsc2UpO1xuZnVuY3Rpb24gdXNlVHJhbnNpdGlvbigpIHtcbiAgcmV0dXJuIFt0cmFuc1BlbmRpbmcsIHN0YXJ0VHJhbnNpdGlvbl07XG59XG5mdW5jdGlvbiByZXN1bWVFZmZlY3RzKGUpIHtcbiAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIGUpO1xuICBlLmxlbmd0aCA9IDA7XG59XG5mdW5jdGlvbiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHVudHJhY2soKCkgPT4ge1xuICAgIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBDb21wKHByb3BzKTtcbiAgfSksIHVuZGVmaW5lZCwgdHJ1ZSwgMCk7XG4gIGMucHJvcHMgPSBwcm9wcztcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLm5hbWUgPSBDb21wLm5hbWU7XG4gIGMuY29tcG9uZW50ID0gQ29tcDtcbiAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiBjLnRWYWx1ZSAhPT0gdW5kZWZpbmVkID8gYy50VmFsdWUgOiBjLnZhbHVlO1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJHcmFwaCh2YWx1ZSkge1xuICBpZiAoT3duZXIpIHtcbiAgICBpZiAoT3duZXIuc291cmNlTWFwKSBPd25lci5zb3VyY2VNYXAucHVzaCh2YWx1ZSk7ZWxzZSBPd25lci5zb3VyY2VNYXAgPSBbdmFsdWVdO1xuICAgIHZhbHVlLmdyYXBoID0gT3duZXI7XG4gIH1cbiAgaWYgKERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCkgRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRleHQoZGVmYXVsdFZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlkID0gU3ltYm9sKFwiY29udGV4dFwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZCxcbiAgICBQcm92aWRlcjogY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpLFxuICAgIGRlZmF1bHRWYWx1ZVxuICB9O1xufVxuZnVuY3Rpb24gdXNlQ29udGV4dChjb250ZXh0KSB7XG4gIGxldCB2YWx1ZTtcbiAgcmV0dXJuIE93bmVyICYmIE93bmVyLmNvbnRleHQgJiYgKHZhbHVlID0gT3duZXIuY29udGV4dFtjb250ZXh0LmlkXSkgIT09IHVuZGVmaW5lZCA/IHZhbHVlIDogY29udGV4dC5kZWZhdWx0VmFsdWU7XG59XG5mdW5jdGlvbiBjaGlsZHJlbihmbikge1xuICBjb25zdCBjaGlsZHJlbiA9IGNyZWF0ZU1lbW8oZm4pO1xuICBjb25zdCBtZW1vID0gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY2hpbGRyZW5cIlxuICB9KSA7XG4gIG1lbW8udG9BcnJheSA9ICgpID0+IHtcbiAgICBjb25zdCBjID0gbWVtbygpO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGMpID8gYyA6IGMgIT0gbnVsbCA/IFtjXSA6IFtdO1xuICB9O1xuICByZXR1cm4gbWVtbztcbn1cbmxldCBTdXNwZW5zZUNvbnRleHQ7XG5mdW5jdGlvbiBnZXRTdXNwZW5zZUNvbnRleHQoKSB7XG4gIHJldHVybiBTdXNwZW5zZUNvbnRleHQgfHwgKFN1c3BlbnNlQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQoKSk7XG59XG5mdW5jdGlvbiBlbmFibGVFeHRlcm5hbFNvdXJjZShmYWN0b3J5LCB1bnRyYWNrID0gZm4gPT4gZm4oKSkge1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHtcbiAgICBjb25zdCB7XG4gICAgICBmYWN0b3J5OiBvbGRGYWN0b3J5LFxuICAgICAgdW50cmFjazogb2xkVW50cmFja1xuICAgIH0gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZztcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3Rvcnk6IChmbiwgdHJpZ2dlcikgPT4ge1xuICAgICAgICBjb25zdCBvbGRTb3VyY2UgPSBvbGRGYWN0b3J5KGZuLCB0cmlnZ2VyKTtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZmFjdG9yeSh4ID0+IG9sZFNvdXJjZS50cmFjayh4KSwgdHJpZ2dlcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHJhY2s6IHggPT4gc291cmNlLnRyYWNrKHgpLFxuICAgICAgICAgIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICBzb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgICAgb2xkU291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgdW50cmFjazogZm4gPT4gb2xkVW50cmFjaygoKSA9PiB1bnRyYWNrKGZuKSlcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeSxcbiAgICAgIHVudHJhY2tcbiAgICB9O1xuICB9XG59XG5mdW5jdGlvbiByZWFkU2lnbmFsKCkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAodGhpcy5zb3VyY2VzICYmIChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkpIHtcbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSA9PT0gU1RBTEUpIHVwZGF0ZUNvbXB1dGF0aW9uKHRoaXMpO2Vsc2Uge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKHRoaXMpLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbiAgaWYgKExpc3RlbmVyKSB7XG4gICAgY29uc3Qgc1Nsb3QgPSB0aGlzLm9ic2VydmVycyA/IHRoaXMub2JzZXJ2ZXJzLmxlbmd0aCA6IDA7XG4gICAgaWYgKCFMaXN0ZW5lci5zb3VyY2VzKSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzID0gW3RoaXNdO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMgPSBbc1Nsb3RdO1xuICAgIH0gZWxzZSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzLnB1c2godGhpcyk7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cy5wdXNoKHNTbG90KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm9ic2VydmVycykge1xuICAgICAgdGhpcy5vYnNlcnZlcnMgPSBbTGlzdGVuZXJdO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzID0gW0xpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzLnB1c2goTGlzdGVuZXIpO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzLnB1c2goTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxKTtcbiAgICB9XG4gIH1cbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXModGhpcykpIHJldHVybiB0aGlzLnRWYWx1ZTtcbiAgcmV0dXJuIHRoaXMudmFsdWU7XG59XG5mdW5jdGlvbiB3cml0ZVNpZ25hbChub2RlLCB2YWx1ZSwgaXNDb21wKSB7XG4gIGxldCBjdXJyZW50ID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZTtcbiAgaWYgKCFub2RlLmNvbXBhcmF0b3IgfHwgIW5vZGUuY29tcGFyYXRvcihjdXJyZW50LCB2YWx1ZSkpIHtcbiAgICBpZiAoVHJhbnNpdGlvbikge1xuICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgfHwgIWlzQ29tcCAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICAgIG5vZGUudFZhbHVlID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICBpZiAobm9kZS5vYnNlcnZlcnMgJiYgbm9kZS5vYnNlcnZlcnMubGVuZ3RoKSB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICAgICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhvKSkgY29udGludWU7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgICAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgICAgICAgIGlmIChvLm9ic2VydmVycykgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG8uc3RhdGUgPSBTVEFMRTtlbHNlIG8udFN0YXRlID0gU1RBTEU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFVwZGF0ZXMubGVuZ3RoID4gMTBlNSkge1xuICAgICAgICAgIFVwZGF0ZXMgPSBbXTtcbiAgICAgICAgICBpZiAoSVNfREVWKSB0aHJvdyBuZXcgRXJyb3IoXCJQb3RlbnRpYWwgSW5maW5pdGUgTG9vcCBEZXRlY3RlZC5cIik7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gdXBkYXRlQ29tcHV0YXRpb24obm9kZSkge1xuICBpZiAoIW5vZGUuZm4pIHJldHVybjtcbiAgY2xlYW5Ob2RlKG5vZGUpO1xuICBjb25zdCB0aW1lID0gRXhlY0NvdW50O1xuICBydW5Db21wdXRhdGlvbihub2RlLCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCB0aW1lKTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgIVRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IHRydWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgICAgICAgcnVuQ29tcHV0YXRpb24obm9kZSwgbm9kZS50VmFsdWUsIHRpbWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9KTtcbiAgfVxufVxuZnVuY3Rpb24gcnVuQ29tcHV0YXRpb24obm9kZSwgdmFsdWUsIHRpbWUpIHtcbiAgbGV0IG5leHRWYWx1ZTtcbiAgY29uc3Qgb3duZXIgPSBPd25lcixcbiAgICBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgdHJ5IHtcbiAgICBuZXh0VmFsdWUgPSBub2RlLmZuKHZhbHVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKG5vZGUucHVyZSkge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICAgIG5vZGUudFN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUudE93bmVkICYmIG5vZGUudE93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS50T3duZWQgPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUub3duZWQgJiYgbm9kZS5vd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUub3duZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWUgKyAxO1xuICAgIHJldHVybiBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxuICBpZiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDw9IHRpbWUpIHtcbiAgICBpZiAobm9kZS51cGRhdGVkQXQgIT0gbnVsbCAmJiBcIm9ic2VydmVyc1wiIGluIG5vZGUpIHtcbiAgICAgIHdyaXRlU2lnbmFsKG5vZGUsIG5leHRWYWx1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICBub2RlLnRWYWx1ZSA9IG5leHRWYWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IG5leHRWYWx1ZTtcbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCBpbml0LCBwdXJlLCBzdGF0ZSA9IFNUQUxFLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSB7XG4gICAgZm4sXG4gICAgc3RhdGU6IHN0YXRlLFxuICAgIHVwZGF0ZWRBdDogbnVsbCxcbiAgICBvd25lZDogbnVsbCxcbiAgICBzb3VyY2VzOiBudWxsLFxuICAgIHNvdXJjZVNsb3RzOiBudWxsLFxuICAgIGNsZWFudXBzOiBudWxsLFxuICAgIHZhbHVlOiBpbml0LFxuICAgIG93bmVyOiBPd25lcixcbiAgICBjb250ZXh0OiBPd25lciA/IE93bmVyLmNvbnRleHQgOiBudWxsLFxuICAgIHB1cmVcbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy5zdGF0ZSA9IDA7XG4gICAgYy50U3RhdGUgPSBzdGF0ZTtcbiAgfVxuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNvbXB1dGF0aW9ucyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBkaXNwb3NlZFwiKTtlbHNlIGlmIChPd25lciAhPT0gVU5PV05FRCkge1xuICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBPd25lci5wdXJlKSB7XG4gICAgICBpZiAoIU93bmVyLnRPd25lZCkgT3duZXIudE93bmVkID0gW2NdO2Vsc2UgT3duZXIudE93bmVkLnB1c2goYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghT3duZXIub3duZWQpIE93bmVyLm93bmVkID0gW2NdO2Vsc2UgT3duZXIub3duZWQucHVzaChjKTtcbiAgICB9XG4gIH1cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5uYW1lKSBjLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBjLmZuKSB7XG4gICAgY29uc3QgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KTtcbiAgICBjb25zdCBvcmRpbmFyeSA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlcik7XG4gICAgb25DbGVhbnVwKCgpID0+IG9yZGluYXJ5LmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgdHJpZ2dlckluVHJhbnNpdGlvbiA9ICgpID0+IHN0YXJ0VHJhbnNpdGlvbih0cmlnZ2VyKS50aGVuKCgpID0+IGluVHJhbnNpdGlvbi5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IGluVHJhbnNpdGlvbiA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlckluVHJhbnNpdGlvbik7XG4gICAgYy5mbiA9IHggPT4ge1xuICAgICAgdHJhY2soKTtcbiAgICAgIHJldHVybiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyA/IGluVHJhbnNpdGlvbi50cmFjayh4KSA6IG9yZGluYXJ5LnRyYWNrKHgpO1xuICAgIH07XG4gIH1cbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKGMpO1xuICByZXR1cm4gYztcbn1cbmZ1bmN0aW9uIHJ1blRvcChub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSAwKSByZXR1cm47XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSByZXR1cm4gbG9va1Vwc3RyZWFtKG5vZGUpO1xuICBpZiAobm9kZS5zdXNwZW5zZSAmJiB1bnRyYWNrKG5vZGUuc3VzcGVuc2UuaW5GYWxsYmFjaykpIHJldHVybiBub2RlLnN1c3BlbnNlLmVmZmVjdHMucHVzaChub2RlKTtcbiAgY29uc3QgYW5jZXN0b3JzID0gW25vZGVdO1xuICB3aGlsZSAoKG5vZGUgPSBub2RlLm93bmVyKSAmJiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkge1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhub2RlKSkgcmV0dXJuO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgYW5jZXN0b3JzLnB1c2gobm9kZSk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IGFuY2VzdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIG5vZGUgPSBhbmNlc3RvcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSB7XG4gICAgICBsZXQgdG9wID0gbm9kZSxcbiAgICAgICAgcHJldiA9IGFuY2VzdG9yc1tpICsgMV07XG4gICAgICB3aGlsZSAoKHRvcCA9IHRvcC5vd25lcikgJiYgdG9wICE9PSBwcmV2KSB7XG4gICAgICAgIGlmIChUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyh0b3ApKSByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBTVEFMRSkge1xuICAgICAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gICAgfSBlbHNlIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0obm9kZSwgYW5jZXN0b3JzWzBdKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5VcGRhdGVzKGZuLCBpbml0KSB7XG4gIGlmIChVcGRhdGVzKSByZXR1cm4gZm4oKTtcbiAgbGV0IHdhaXQgPSBmYWxzZTtcbiAgaWYgKCFpbml0KSBVcGRhdGVzID0gW107XG4gIGlmIChFZmZlY3RzKSB3YWl0ID0gdHJ1ZTtlbHNlIEVmZmVjdHMgPSBbXTtcbiAgRXhlY0NvdW50Kys7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gZm4oKTtcbiAgICBjb21wbGV0ZVVwZGF0ZXMod2FpdCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKCF3YWl0KSBFZmZlY3RzID0gbnVsbDtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9XG59XG5mdW5jdGlvbiBjb21wbGV0ZVVwZGF0ZXMod2FpdCkge1xuICBpZiAoVXBkYXRlcykge1xuICAgIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHNjaGVkdWxlUXVldWUoVXBkYXRlcyk7ZWxzZSBydW5RdWV1ZShVcGRhdGVzKTtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgfVxuICBpZiAod2FpdCkgcmV0dXJuO1xuICBsZXQgcmVzO1xuICBpZiAoVHJhbnNpdGlvbikge1xuICAgIGlmICghVHJhbnNpdGlvbi5wcm9taXNlcy5zaXplICYmICFUcmFuc2l0aW9uLnF1ZXVlLnNpemUpIHtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBUcmFuc2l0aW9uLnNvdXJjZXM7XG4gICAgICBjb25zdCBkaXNwb3NlZCA9IFRyYW5zaXRpb24uZGlzcG9zZWQ7XG4gICAgICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgVHJhbnNpdGlvbi5lZmZlY3RzKTtcbiAgICAgIHJlcyA9IFRyYW5zaXRpb24ucmVzb2x2ZTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiBFZmZlY3RzKSB7XG4gICAgICAgIFwidFN0YXRlXCIgaW4gZSAmJiAoZS5zdGF0ZSA9IGUudFN0YXRlKTtcbiAgICAgICAgZGVsZXRlIGUudFN0YXRlO1xuICAgICAgfVxuICAgICAgVHJhbnNpdGlvbiA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBkIG9mIGRpc3Bvc2VkKSBjbGVhbk5vZGUoZCk7XG4gICAgICAgIGZvciAoY29uc3QgdiBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgdi52YWx1ZSA9IHYudFZhbHVlO1xuICAgICAgICAgIGlmICh2Lm93bmVkKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdi5vd25lZC5sZW5ndGg7IGkgPCBsZW47IGkrKykgY2xlYW5Ob2RlKHYub3duZWRbaV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodi50T3duZWQpIHYub3duZWQgPSB2LnRPd25lZDtcbiAgICAgICAgICBkZWxldGUgdi50VmFsdWU7XG4gICAgICAgICAgZGVsZXRlIHYudE93bmVkO1xuICAgICAgICAgIHYudFN0YXRlID0gMDtcbiAgICAgICAgfVxuICAgICAgICBzZXRUcmFuc1BlbmRpbmcoZmFsc2UpO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIFRyYW5zaXRpb24uZWZmZWN0cy5wdXNoLmFwcGx5KFRyYW5zaXRpb24uZWZmZWN0cywgRWZmZWN0cyk7XG4gICAgICBFZmZlY3RzID0gbnVsbDtcbiAgICAgIHNldFRyYW5zUGVuZGluZyh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgY29uc3QgZSA9IEVmZmVjdHM7XG4gIEVmZmVjdHMgPSBudWxsO1xuICBpZiAoZS5sZW5ndGgpIHJ1blVwZGF0ZXMoKCkgPT4gcnVuRWZmZWN0cyhlKSwgZmFsc2UpO2Vsc2UgRGV2SG9va3MuYWZ0ZXJVcGRhdGUgJiYgRGV2SG9va3MuYWZ0ZXJVcGRhdGUoKTtcbiAgaWYgKHJlcykgcmVzKCk7XG59XG5mdW5jdGlvbiBydW5RdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gc2NoZWR1bGVRdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaXRlbSA9IHF1ZXVlW2ldO1xuICAgIGNvbnN0IHRhc2tzID0gVHJhbnNpdGlvbi5xdWV1ZTtcbiAgICBpZiAoIXRhc2tzLmhhcyhpdGVtKSkge1xuICAgICAgdGFza3MuYWRkKGl0ZW0pO1xuICAgICAgU2NoZWR1bGVyKCgpID0+IHtcbiAgICAgICAgdGFza3MuZGVsZXRlKGl0ZW0pO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIHJ1blRvcChpdGVtKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVzZXJFZmZlY3RzKHF1ZXVlKSB7XG4gIGxldCBpLFxuICAgIHVzZXJMZW5ndGggPSAwO1xuICBmb3IgKGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlID0gcXVldWVbaV07XG4gICAgaWYgKCFlLnVzZXIpIHJ1blRvcChlKTtlbHNlIHF1ZXVlW3VzZXJMZW5ndGgrK10gPSBlO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY291bnQpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzIHx8IChzaGFyZWRDb25maWcuZWZmZWN0cyA9IFtdKTtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzLnB1c2goLi4ucXVldWUuc2xpY2UoMCwgdXNlckxlbmd0aCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuZWZmZWN0cyAmJiAoc2hhcmVkQ29uZmlnLmRvbmUgfHwgIXNoYXJlZENvbmZpZy5jb3VudCkpIHtcbiAgICBxdWV1ZSA9IFsuLi5zaGFyZWRDb25maWcuZWZmZWN0cywgLi4ucXVldWVdO1xuICAgIHVzZXJMZW5ndGggKz0gc2hhcmVkQ29uZmlnLmVmZmVjdHMubGVuZ3RoO1xuICAgIGRlbGV0ZSBzaGFyZWRDb25maWcuZWZmZWN0cztcbiAgfVxuICBmb3IgKGkgPSAwOyBpIDwgdXNlckxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gbG9va1Vwc3RyZWFtKG5vZGUsIGlnbm9yZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuc291cmNlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlc1tpXTtcbiAgICBpZiAoc291cmNlLnNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHN0YXRlID0gcnVubmluZ1RyYW5zaXRpb24gPyBzb3VyY2UudFN0YXRlIDogc291cmNlLnN0YXRlO1xuICAgICAgaWYgKHN0YXRlID09PSBTVEFMRSkge1xuICAgICAgICBpZiAoc291cmNlICE9PSBpZ25vcmUgJiYgKCFzb3VyY2UudXBkYXRlZEF0IHx8IHNvdXJjZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSBydW5Ub3Aoc291cmNlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IFBFTkRJTkcpIGxvb2tVcHN0cmVhbShzb3VyY2UsIGlnbm9yZSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBtYXJrRG93bnN0cmVhbShub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikgby50U3RhdGUgPSBQRU5ESU5HO2Vsc2Ugby5zdGF0ZSA9IFBFTkRJTkc7XG4gICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICBvLm9ic2VydmVycyAmJiBtYXJrRG93bnN0cmVhbShvKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFuTm9kZShub2RlKSB7XG4gIGxldCBpO1xuICBpZiAobm9kZS5zb3VyY2VzKSB7XG4gICAgd2hpbGUgKG5vZGUuc291cmNlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlcy5wb3AoKSxcbiAgICAgICAgaW5kZXggPSBub2RlLnNvdXJjZVNsb3RzLnBvcCgpLFxuICAgICAgICBvYnMgPSBzb3VyY2Uub2JzZXJ2ZXJzO1xuICAgICAgaWYgKG9icyAmJiBvYnMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IG4gPSBvYnMucG9wKCksXG4gICAgICAgICAgcyA9IHNvdXJjZS5vYnNlcnZlclNsb3RzLnBvcCgpO1xuICAgICAgICBpZiAoaW5kZXggPCBvYnMubGVuZ3RoKSB7XG4gICAgICAgICAgbi5zb3VyY2VTbG90c1tzXSA9IGluZGV4O1xuICAgICAgICAgIG9ic1tpbmRleF0gPSBuO1xuICAgICAgICAgIHNvdXJjZS5vYnNlcnZlclNsb3RzW2luZGV4XSA9IHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKG5vZGUudE93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS50T3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLnRPd25lZFtpXSk7XG4gICAgZGVsZXRlIG5vZGUudE93bmVkO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICByZXNldChub2RlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS5vd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUub3duZWRbaV0pO1xuICAgIG5vZGUub3duZWQgPSBudWxsO1xuICB9XG4gIGlmIChub2RlLmNsZWFudXBzKSB7XG4gICAgZm9yIChpID0gbm9kZS5jbGVhbnVwcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgbm9kZS5jbGVhbnVwc1tpXSgpO1xuICAgIG5vZGUuY2xlYW51cHMgPSBudWxsO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGRlbGV0ZSBub2RlLnNvdXJjZU1hcDtcbn1cbmZ1bmN0aW9uIHJlc2V0KG5vZGUsIHRvcCkge1xuICBpZiAoIXRvcCkge1xuICAgIG5vZGUudFN0YXRlID0gMDtcbiAgICBUcmFuc2l0aW9uLmRpc3Bvc2VkLmFkZChub2RlKTtcbiAgfVxuICBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vd25lZC5sZW5ndGg7IGkrKykgcmVzZXQobm9kZS5vd25lZFtpXSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGNhc3RFcnJvcihlcnIpIHtcbiAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gZXJyO1xuICByZXR1cm4gbmV3IEVycm9yKHR5cGVvZiBlcnIgPT09IFwic3RyaW5nXCIgPyBlcnIgOiBcIlVua25vd24gZXJyb3JcIiwge1xuICAgIGNhdXNlOiBlcnJcbiAgfSk7XG59XG5mdW5jdGlvbiBydW5FcnJvcnMoZXJyLCBmbnMsIG93bmVyKSB7XG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCBmIG9mIGZucykgZihlcnIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaGFuZGxlRXJyb3IoZSwgb3duZXIgJiYgb3duZXIub3duZXIgfHwgbnVsbCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGhhbmRsZUVycm9yKGVyciwgb3duZXIgPSBPd25lcikge1xuICBjb25zdCBmbnMgPSBFUlJPUiAmJiBvd25lciAmJiBvd25lci5jb250ZXh0ICYmIG93bmVyLmNvbnRleHRbRVJST1JdO1xuICBjb25zdCBlcnJvciA9IGNhc3RFcnJvcihlcnIpO1xuICBpZiAoIWZucykgdGhyb3cgZXJyb3I7XG4gIGlmIChFZmZlY3RzKSBFZmZlY3RzLnB1c2goe1xuICAgIGZuKCkge1xuICAgICAgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbiAgICB9LFxuICAgIHN0YXRlOiBTVEFMRVxuICB9KTtlbHNlIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG59XG5mdW5jdGlvbiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgaWYgKHR5cGVvZiBjaGlsZHJlbiA9PT0gXCJmdW5jdGlvblwiICYmICFjaGlsZHJlbi5sZW5ndGgpIHJldHVybiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSk7XG4gIGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW5baV0pO1xuICAgICAgQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0cy5wdXNoLmFwcGx5KHJlc3VsdHMsIHJlc3VsdCkgOiByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbiAgcmV0dXJuIGNoaWxkcmVuO1xufVxuZnVuY3Rpb24gY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHByb3ZpZGVyKHByb3BzKSB7XG4gICAgbGV0IHJlcztcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcmVzID0gdW50cmFjaygoKSA9PiB7XG4gICAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgICBbaWRdOiBwcm9wcy52YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgfSksIHVuZGVmaW5lZCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uRXJyb3IoZm4pIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImVycm9yIGhhbmRsZXJzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jb250ZXh0ID09PSBudWxsIHx8ICFPd25lci5jb250ZXh0W0VSUk9SXSkge1xuICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgW0VSUk9SXTogW2ZuXVxuICAgIH07XG4gICAgbXV0YXRlQ29udGV4dChPd25lciwgRVJST1IsIFtmbl0pO1xuICB9IGVsc2UgT3duZXIuY29udGV4dFtFUlJPUl0ucHVzaChmbik7XG59XG5mdW5jdGlvbiBtdXRhdGVDb250ZXh0KG8sIGtleSwgdmFsdWUpIHtcbiAgaWYgKG8ub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG8ub3duZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChvLm93bmVkW2ldLmNvbnRleHQgPT09IG8uY29udGV4dCkgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIGlmICghby5vd25lZFtpXS5jb250ZXh0KSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dCA9IG8uY29udGV4dDtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoIW8ub3duZWRbaV0uY29udGV4dFtrZXldKSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dFtrZXldID0gdmFsdWU7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9ic2VydmFibGUoaW5wdXQpIHtcbiAgcmV0dXJuIHtcbiAgICBzdWJzY3JpYmUob2JzZXJ2ZXIpIHtcbiAgICAgIGlmICghKG9ic2VydmVyIGluc3RhbmNlb2YgT2JqZWN0KSB8fCBvYnNlcnZlciA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFeHBlY3RlZCB0aGUgb2JzZXJ2ZXIgdG8gYmUgYW4gb2JqZWN0LlwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGhhbmRsZXIgPSB0eXBlb2Ygb2JzZXJ2ZXIgPT09IFwiZnVuY3Rpb25cIiA/IG9ic2VydmVyIDogb2JzZXJ2ZXIubmV4dCAmJiBvYnNlcnZlci5uZXh0LmJpbmQob2JzZXJ2ZXIpO1xuICAgICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdW5zdWJzY3JpYmUoKSB7fVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgZGlzcG9zZSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHYgPSBpbnB1dCgpO1xuICAgICAgICAgIHVudHJhY2soKCkgPT4gaGFuZGxlcih2KSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGlzcG9zZXI7XG4gICAgICB9KTtcbiAgICAgIGlmIChnZXRPd25lcigpKSBvbkNsZWFudXAoZGlzcG9zZSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpIHtcbiAgICAgICAgICBkaXNwb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSxcbiAgICBbU3ltYm9sLm9ic2VydmFibGUgfHwgXCJAQG9ic2VydmFibGVcIl0oKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBmcm9tKHByb2R1Y2VyLCBpbml0YWxWYWx1ZSA9IHVuZGVmaW5lZCkge1xuICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChpbml0YWxWYWx1ZSwge1xuICAgIGVxdWFsczogZmFsc2VcbiAgfSk7XG4gIGlmIChcInN1YnNjcmliZVwiIGluIHByb2R1Y2VyKSB7XG4gICAgY29uc3QgdW5zdWIgPSBwcm9kdWNlci5zdWJzY3JpYmUodiA9PiBzZXQoKCkgPT4gdikpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBcInVuc3Vic2NyaWJlXCIgaW4gdW5zdWIgPyB1bnN1Yi51bnN1YnNjcmliZSgpIDogdW5zdWIoKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2xlYW4gPSBwcm9kdWNlcihzZXQpO1xuICAgIG9uQ2xlYW51cChjbGVhbik7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbmNvbnN0IEZBTExCQUNLID0gU3ltYm9sKFwiZmFsbGJhY2tcIik7XG5mdW5jdGlvbiBkaXNwb3NlKGQpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkLmxlbmd0aDsgaSsrKSBkW2ldKCk7XG59XG5mdW5jdGlvbiBtYXBBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaW5kZXhlcyA9IG1hcEZuLmxlbmd0aCA+IDEgPyBbXSA6IG51bGw7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGxldCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aCxcbiAgICAgIGksXG4gICAgICBqO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgbGV0IG5ld0luZGljZXMsIG5ld0luZGljZXNOZXh0LCB0ZW1wLCB0ZW1wZGlzcG9zZXJzLCB0ZW1wSW5kZXhlcywgc3RhcnQsIGVuZCwgbmV3RW5kLCBpdGVtO1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBpbmRleGVzICYmIChpbmRleGVzID0gW10pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgICBtYXBwZWQgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaXRlbXNbal0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gbmV3TGVuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICB0ZW1wZGlzcG9zZXJzID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzID0gbmV3IEFycmF5KG5ld0xlbikpO1xuICAgICAgICBmb3IgKHN0YXJ0ID0gMCwgZW5kID0gTWF0aC5taW4obGVuLCBuZXdMZW4pOyBzdGFydCA8IGVuZCAmJiBpdGVtc1tzdGFydF0gPT09IG5ld0l0ZW1zW3N0YXJ0XTsgc3RhcnQrKyk7XG4gICAgICAgIGZvciAoZW5kID0gbGVuIC0gMSwgbmV3RW5kID0gbmV3TGVuIC0gMTsgZW5kID49IHN0YXJ0ICYmIG5ld0VuZCA+PSBzdGFydCAmJiBpdGVtc1tlbmRdID09PSBuZXdJdGVtc1tuZXdFbmRdOyBlbmQtLSwgbmV3RW5kLS0pIHtcbiAgICAgICAgICB0ZW1wW25ld0VuZF0gPSBtYXBwZWRbZW5kXTtcbiAgICAgICAgICB0ZW1wZGlzcG9zZXJzW25ld0VuZF0gPSBkaXNwb3NlcnNbZW5kXTtcbiAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tuZXdFbmRdID0gaW5kZXhlc1tlbmRdKTtcbiAgICAgICAgfVxuICAgICAgICBuZXdJbmRpY2VzID0gbmV3IE1hcCgpO1xuICAgICAgICBuZXdJbmRpY2VzTmV4dCA9IG5ldyBBcnJheShuZXdFbmQgKyAxKTtcbiAgICAgICAgZm9yIChqID0gbmV3RW5kOyBqID49IHN0YXJ0OyBqLS0pIHtcbiAgICAgICAgICBpdGVtID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgaSA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIG5ld0luZGljZXNOZXh0W2pdID0gaSA9PT0gdW5kZWZpbmVkID8gLTEgOiBpO1xuICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XG4gICAgICAgICAgaXRlbSA9IGl0ZW1zW2ldO1xuICAgICAgICAgIGogPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBpZiAoaiAhPT0gdW5kZWZpbmVkICYmIGogIT09IC0xKSB7XG4gICAgICAgICAgICB0ZW1wW2pdID0gbWFwcGVkW2ldO1xuICAgICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2Vyc1tpXTtcbiAgICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW2pdID0gaW5kZXhlc1tpXSk7XG4gICAgICAgICAgICBqID0gbmV3SW5kaWNlc05leHRbal07XG4gICAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgICB9IGVsc2UgZGlzcG9zZXJzW2ldKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChqID0gc3RhcnQ7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGlmIChqIGluIHRlbXApIHtcbiAgICAgICAgICAgIG1hcHBlZFtqXSA9IHRlbXBbal07XG4gICAgICAgICAgICBkaXNwb3NlcnNbal0gPSB0ZW1wZGlzcG9zZXJzW2pdO1xuICAgICAgICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXSA9IHRlbXBJbmRleGVzW2pdO1xuICAgICAgICAgICAgICBpbmRleGVzW2pdKGopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbiA9IG5ld0xlbik7XG4gICAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwcGVkO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2pdID0gZGlzcG9zZXI7XG4gICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChqLCB7XG4gICAgICAgICAgbmFtZTogXCJpbmRleFwiXG4gICAgICAgIH0pIDtcbiAgICAgICAgaW5kZXhlc1tqXSA9IHNldDtcbiAgICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdLCBzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gaW5kZXhBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIHNpZ25hbHMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGk7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGNvbnN0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBzaWduYWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgICAgfVxuICAgICAgaWYgKGl0ZW1zWzBdID09PSBGQUxMQkFDSykge1xuICAgICAgICBkaXNwb3NlcnNbMF0oKTtcbiAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICBsZW4gPSAwO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IG5ld0xlbjsgaSsrKSB7XG4gICAgICAgIGlmIChpIDwgaXRlbXMubGVuZ3RoICYmIGl0ZW1zW2ldICE9PSBuZXdJdGVtc1tpXSkge1xuICAgICAgICAgIHNpZ25hbHNbaV0oKCkgPT4gbmV3SXRlbXNbaV0pO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPj0gaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgbWFwcGVkW2ldID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgfVxuICAgICAgbGVuID0gc2lnbmFscy5sZW5ndGggPSBkaXNwb3NlcnMubGVuZ3RoID0gbmV3TGVuO1xuICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIHJldHVybiBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuKTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tpXSA9IGRpc3Bvc2VyO1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwobmV3SXRlbXNbaV0sIHtcbiAgICAgICAgbmFtZTogXCJ2YWx1ZVwiXG4gICAgICB9KSA7XG4gICAgICBzaWduYWxzW2ldID0gc2V0O1xuICAgICAgcmV0dXJuIG1hcEZuKHMsIGkpO1xuICAgIH1cbiAgfTtcbn1cblxubGV0IGh5ZHJhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGVuYWJsZUh5ZHJhdGlvbigpIHtcbiAgaHlkcmF0aW9uRW5hYmxlZCA9IHRydWU7XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgaWYgKGh5ZHJhdGlvbkVuYWJsZWQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KG5leHRIeWRyYXRlQ29udGV4dCgpKTtcbiAgICAgIGNvbnN0IHIgPSBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pIDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pO1xufVxuZnVuY3Rpb24gdHJ1ZUZuKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cbmNvbnN0IHByb3BUcmFwcyA9IHtcbiAgZ2V0KF8sIHByb3BlcnR5LCByZWNlaXZlcikge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gcmVjZWl2ZXI7XG4gICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgfSxcbiAgaGFzKF8sIHByb3BlcnR5KSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBfLmhhcyhwcm9wZXJ0eSk7XG4gIH0sXG4gIHNldDogdHJ1ZUZuLFxuICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuLFxuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXywgcHJvcGVydHkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IHRydWVGbixcbiAgICAgIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm5cbiAgICB9O1xuICB9LFxuICBvd25LZXlzKF8pIHtcbiAgICByZXR1cm4gXy5rZXlzKCk7XG4gIH1cbn07XG5mdW5jdGlvbiByZXNvbHZlU291cmNlKHMpIHtcbiAgcmV0dXJuICEocyA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyBzKCkgOiBzKSA/IHt9IDogcztcbn1cbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2VzKCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdGhpcy5sZW5ndGg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IHYgPSB0aGlzW2ldKCk7XG4gICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gIH1cbn1cbmZ1bmN0aW9uIG1lcmdlUHJvcHMoLi4uc291cmNlcykge1xuICBsZXQgcHJveHkgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcyA9IHNvdXJjZXNbaV07XG4gICAgcHJveHkgPSBwcm94eSB8fCAhIXMgJiYgJFBST1hZIGluIHM7XG4gICAgc291cmNlc1tpXSA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyAocHJveHkgPSB0cnVlLCBjcmVhdGVNZW1vKHMpKSA6IHM7XG4gIH1cbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmIHByb3h5KSB7XG4gICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBjb25zdCB2ID0gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKVtwcm9wZXJ0eV07XG4gICAgICAgICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBpZiAocHJvcGVydHkgaW4gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSBrZXlzLnB1c2goLi4uT2JqZWN0LmtleXMocmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkpO1xuICAgICAgICByZXR1cm4gWy4uLm5ldyBTZXQoa2V5cyldO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcyk7XG4gIH1cbiAgY29uc3Qgc291cmNlc01hcCA9IHt9O1xuICBjb25zdCBkZWZpbmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBzb3VyY2UgPSBzb3VyY2VzW2ldO1xuICAgIGlmICghc291cmNlKSBjb250aW51ZTtcbiAgICBjb25zdCBzb3VyY2VLZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoc291cmNlKTtcbiAgICBmb3IgKGxldCBpID0gc291cmNlS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3Qga2V5ID0gc291cmNlS2V5c1tpXTtcbiAgICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc291cmNlLCBrZXkpO1xuICAgICAgaWYgKCFkZWZpbmVkW2tleV0pIHtcbiAgICAgICAgZGVmaW5lZFtrZXldID0gZGVzYy5nZXQgPyB7XG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZ2V0OiByZXNvbHZlU291cmNlcy5iaW5kKHNvdXJjZXNNYXBba2V5XSA9IFtkZXNjLmdldC5iaW5kKHNvdXJjZSldKVxuICAgICAgICB9IDogZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gZGVzYyA6IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPSBzb3VyY2VzTWFwW2tleV07XG4gICAgICAgIGlmIChzb3VyY2VzKSB7XG4gICAgICAgICAgaWYgKGRlc2MuZ2V0KSBzb3VyY2VzLnB1c2goZGVzYy5nZXQuYmluZChzb3VyY2UpKTtlbHNlIGlmIChkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQpIHNvdXJjZXMucHVzaCgoKSA9PiBkZXNjLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCB0YXJnZXQgPSB7fTtcbiAgY29uc3QgZGVmaW5lZEtleXMgPSBPYmplY3Qua2V5cyhkZWZpbmVkKTtcbiAgZm9yIChsZXQgaSA9IGRlZmluZWRLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qga2V5ID0gZGVmaW5lZEtleXNbaV0sXG4gICAgICBkZXNjID0gZGVmaW5lZFtrZXldO1xuICAgIGlmIChkZXNjICYmIGRlc2MuZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2MpO2Vsc2UgdGFyZ2V0W2tleV0gPSBkZXNjID8gZGVzYy52YWx1ZSA6IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuZnVuY3Rpb24gc3BsaXRQcm9wcyhwcm9wcywgLi4ua2V5cykge1xuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgJFBST1hZIGluIHByb3BzKSB7XG4gICAgY29uc3QgYmxvY2tlZCA9IG5ldyBTZXQoa2V5cy5sZW5ndGggPiAxID8ga2V5cy5mbGF0KCkgOiBrZXlzWzBdKTtcbiAgICBjb25zdCByZXMgPSBrZXlzLm1hcChrID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgPyBwcm9wc1twcm9wZXJ0eV0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSAmJiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgICAgfSxcbiAgICAgICAga2V5cygpIHtcbiAgICAgICAgICByZXR1cm4gay5maWx0ZXIocHJvcGVydHkgPT4gcHJvcGVydHkgaW4gcHJvcHMpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9wVHJhcHMpO1xuICAgIH0pO1xuICAgIHJlcy5wdXNoKG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IHVuZGVmaW5lZCA6IHByb3BzW3Byb3BlcnR5XTtcbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IGZhbHNlIDogcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKS5maWx0ZXIoayA9PiAhYmxvY2tlZC5oYXMoaykpO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcykpO1xuICAgIHJldHVybiByZXM7XG4gIH1cbiAgY29uc3Qgb3RoZXJPYmplY3QgPSB7fTtcbiAgY29uc3Qgb2JqZWN0cyA9IGtleXMubWFwKCgpID0+ICh7fSkpO1xuICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BzKSkge1xuICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3BzLCBwcm9wTmFtZSk7XG4gICAgY29uc3QgaXNEZWZhdWx0RGVzYyA9ICFkZXNjLmdldCAmJiAhZGVzYy5zZXQgJiYgZGVzYy5lbnVtZXJhYmxlICYmIGRlc2Mud3JpdGFibGUgJiYgZGVzYy5jb25maWd1cmFibGU7XG4gICAgbGV0IGJsb2NrZWQgPSBmYWxzZTtcbiAgICBsZXQgb2JqZWN0SW5kZXggPSAwO1xuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICBpZiAoay5pbmNsdWRlcyhwcm9wTmFtZSkpIHtcbiAgICAgICAgYmxvY2tlZCA9IHRydWU7XG4gICAgICAgIGlzRGVmYXVsdERlc2MgPyBvYmplY3RzW29iamVjdEluZGV4XVtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdHNbb2JqZWN0SW5kZXhdLCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgICB9XG4gICAgICArK29iamVjdEluZGV4O1xuICAgIH1cbiAgICBpZiAoIWJsb2NrZWQpIHtcbiAgICAgIGlzRGVmYXVsdERlc2MgPyBvdGhlck9iamVjdFtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG90aGVyT2JqZWN0LCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgfVxuICB9XG4gIHJldHVybiBbLi4ub2JqZWN0cywgb3RoZXJPYmplY3RdO1xufVxuZnVuY3Rpb24gbGF6eShmbikge1xuICBsZXQgY29tcDtcbiAgbGV0IHA7XG4gIGNvbnN0IHdyYXAgPSBwcm9wcyA9PiB7XG4gICAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgaWYgKGN0eCkge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCB8fCAoc2hhcmVkQ29uZmlnLmNvdW50ID0gMCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQrKztcbiAgICAgIChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IHtcbiAgICAgICAgIXNoYXJlZENvbmZpZy5kb25lICYmIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb3VudC0tO1xuICAgICAgICBzZXQoKCkgPT4gbW9kLmRlZmF1bHQpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSk7XG4gICAgICBjb21wID0gcztcbiAgICB9IGVsc2UgaWYgKCFjb21wKSB7XG4gICAgICBjb25zdCBbc10gPSBjcmVhdGVSZXNvdXJjZSgoKSA9PiAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiBtb2QuZGVmYXVsdCkpO1xuICAgICAgY29tcCA9IHM7XG4gICAgfVxuICAgIGxldCBDb21wO1xuICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IChDb21wID0gY29tcCgpKSA/IHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKElTX0RFVikgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgIH0pO1xuICAgICAgaWYgKCFjdHggfHwgc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBDb21wKHByb3BzKTtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICBjb25zdCByID0gQ29tcChwcm9wcyk7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH0pIDogXCJcIik7XG4gIH07XG4gIHdyYXAucHJlbG9hZCA9ICgpID0+IHAgfHwgKChwID0gZm4oKSkudGhlbihtb2QgPT4gY29tcCA9ICgpID0+IG1vZC5kZWZhdWx0KSwgcCk7XG4gIHJldHVybiB3cmFwO1xufVxubGV0IGNvdW50ZXIgPSAwO1xuZnVuY3Rpb24gY3JlYXRlVW5pcXVlSWQoKSB7XG4gIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICByZXR1cm4gY3R4ID8gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSA6IGBjbC0ke2NvdW50ZXIrK31gO1xufVxuXG5jb25zdCBuYXJyb3dlZEVycm9yID0gbmFtZSA9PiBgQXR0ZW1wdGluZyB0byBhY2Nlc3MgYSBzdGFsZSB2YWx1ZSBmcm9tIDwke25hbWV9PiB0aGF0IGNvdWxkIHBvc3NpYmx5IGJlIHVuZGVmaW5lZC4gVGhpcyBtYXkgb2NjdXIgYmVjYXVzZSB5b3UgYXJlIHJlYWRpbmcgdGhlIGFjY2Vzc29yIHJldHVybmVkIGZyb20gdGhlIGNvbXBvbmVudCBhdCBhIHRpbWUgd2hlcmUgaXQgaGFzIGFscmVhZHkgYmVlbiB1bm1vdW50ZWQuIFdlIHJlY29tbWVuZCBjbGVhbmluZyB1cCBhbnkgc3RhbGUgdGltZXJzIG9yIGFzeW5jLCBvciByZWFkaW5nIGZyb20gdGhlIGluaXRpYWwgY29uZGl0aW9uLmAgO1xuZnVuY3Rpb24gRm9yKHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8obWFwQXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBJbmRleChwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKGluZGV4QXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBTaG93KHByb3BzKSB7XG4gIGNvbnN0IGtleWVkID0gcHJvcHMua2V5ZWQ7XG4gIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy53aGVuLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gIH0gKTtcbiAgY29uc3QgY29uZGl0aW9uID0ga2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gIH0gKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBjb25kaXRpb24oKTtcbiAgICBpZiAoYykge1xuICAgICAgY29uc3QgY2hpbGQgPSBwcm9wcy5jaGlsZHJlbjtcbiAgICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQoa2V5ZWQgPyBjIDogKCkgPT4ge1xuICAgICAgICBpZiAoIXVudHJhY2soY29uZGl0aW9uKSkgdGhyb3cgbmFycm93ZWRFcnJvcihcIlNob3dcIik7XG4gICAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgICAgfSkpIDogY2hpbGQ7XG4gICAgfVxuICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIFN3aXRjaChwcm9wcykge1xuICBjb25zdCBjaHMgPSBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gIGNvbnN0IHN3aXRjaEZ1bmMgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjaCA9IGNocygpO1xuICAgIGNvbnN0IG1wcyA9IEFycmF5LmlzQXJyYXkoY2gpID8gY2ggOiBbY2hdO1xuICAgIGxldCBmdW5jID0gKCkgPT4gdW5kZWZpbmVkO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmRleCA9IGk7XG4gICAgICBjb25zdCBtcCA9IG1wc1tpXTtcbiAgICAgIGNvbnN0IHByZXZGdW5jID0gZnVuYztcbiAgICAgIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcmV2RnVuYygpID8gdW5kZWZpbmVkIDogbXAud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgICAgIH0gKTtcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgICAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gICAgICB9ICk7XG4gICAgICBmdW5jID0gKCkgPT4gcHJldkZ1bmMoKSB8fCAoY29uZGl0aW9uKCkgPyBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gOiB1bmRlZmluZWQpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuYztcbiAgfSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBzZWwgPSBzd2l0Y2hGdW5jKCkoKTtcbiAgICBpZiAoIXNlbCkgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgIGNvbnN0IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA9IHNlbDtcbiAgICBjb25zdCBjaGlsZCA9IG1wLmNoaWxkcmVuO1xuICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUoKSA6ICgpID0+IHtcbiAgICAgIGlmICh1bnRyYWNrKHN3aXRjaEZ1bmMpKCk/LlswXSAhPT0gaW5kZXgpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJNYXRjaFwiKTtcbiAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgIH0pKSA6IGNoaWxkO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImV2YWwgY29uZGl0aW9uc1wiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIE1hdGNoKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcztcbn1cbmxldCBFcnJvcnM7XG5mdW5jdGlvbiByZXNldEVycm9yQm91bmRhcmllcygpIHtcbiAgRXJyb3JzICYmIFsuLi5FcnJvcnNdLmZvckVhY2goZm4gPT4gZm4oKSk7XG59XG5mdW5jdGlvbiBFcnJvckJvdW5kYXJ5KHByb3BzKSB7XG4gIGxldCBlcnI7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkgZXJyID0gc2hhcmVkQ29uZmlnLmxvYWQoc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpKTtcbiAgY29uc3QgW2Vycm9yZWQsIHNldEVycm9yZWRdID0gY3JlYXRlU2lnbmFsKGVyciwge1xuICAgIG5hbWU6IFwiZXJyb3JlZFwiXG4gIH0gKTtcbiAgRXJyb3JzIHx8IChFcnJvcnMgPSBuZXcgU2V0KCkpO1xuICBFcnJvcnMuYWRkKHNldEVycm9yZWQpO1xuICBvbkNsZWFudXAoKCkgPT4gRXJyb3JzLmRlbGV0ZShzZXRFcnJvcmVkKSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBsZXQgZTtcbiAgICBpZiAoZSA9IGVycm9yZWQoKSkge1xuICAgICAgY29uc3QgZiA9IHByb3BzLmZhbGxiYWNrO1xuICAgICAgaWYgKCh0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiIHx8IGYubGVuZ3RoID09IDApKSBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgcmV0dXJuIHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIgJiYgZi5sZW5ndGggPyB1bnRyYWNrKCgpID0+IGYoZSwgKCkgPT4gc2V0RXJyb3JlZCgpKSkgOiBmO1xuICAgIH1cbiAgICByZXR1cm4gY2F0Y2hFcnJvcigoKSA9PiBwcm9wcy5jaGlsZHJlbiwgc2V0RXJyb3JlZCk7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5cbmNvbnN0IHN1c3BlbnNlTGlzdEVxdWFscyA9IChhLCBiKSA9PiBhLnNob3dDb250ZW50ID09PSBiLnNob3dDb250ZW50ICYmIGEuc2hvd0ZhbGxiYWNrID09PSBiLnNob3dGYWxsYmFjaztcbmNvbnN0IFN1c3BlbnNlTGlzdENvbnRleHQgPSAvKiAjX19QVVJFX18gKi9jcmVhdGVDb250ZXh0KCk7XG5mdW5jdGlvbiBTdXNwZW5zZUxpc3QocHJvcHMpIHtcbiAgbGV0IFt3cmFwcGVyLCBzZXRXcmFwcGVyXSA9IGNyZWF0ZVNpZ25hbCgoKSA9PiAoe1xuICAgICAgaW5GYWxsYmFjazogZmFsc2VcbiAgICB9KSksXG4gICAgc2hvdztcbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBjb25zdCBbcmVnaXN0cnksIHNldFJlZ2lzdHJ5XSA9IGNyZWF0ZVNpZ25hbChbXSk7XG4gIGlmIChsaXN0Q29udGV4dCkge1xuICAgIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihjcmVhdGVNZW1vKCgpID0+IHdyYXBwZXIoKSgpLmluRmFsbGJhY2spKTtcbiAgfVxuICBjb25zdCByZXNvbHZlZCA9IGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgY29uc3QgcmV2ZWFsID0gcHJvcHMucmV2ZWFsT3JkZXIsXG4gICAgICB0YWlsID0gcHJvcHMudGFpbCxcbiAgICAgIHtcbiAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9LFxuICAgICAgcmVnID0gcmVnaXN0cnkoKSxcbiAgICAgIHJldmVyc2UgPSByZXZlYWwgPT09IFwiYmFja3dhcmRzXCI7XG4gICAgaWYgKHJldmVhbCA9PT0gXCJ0b2dldGhlclwiKSB7XG4gICAgICBjb25zdCBhbGwgPSByZWcuZXZlcnkoaW5GYWxsYmFjayA9PiAhaW5GYWxsYmFjaygpKTtcbiAgICAgIGNvbnN0IHJlcyA9IHJlZy5tYXAoKCkgPT4gKHtcbiAgICAgICAgc2hvd0NvbnRlbnQ6IGFsbCAmJiBzaG93Q29udGVudCxcbiAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICB9KSk7XG4gICAgICByZXMuaW5GYWxsYmFjayA9ICFhbGw7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgICBsZXQgc3RvcCA9IGZhbHNlO1xuICAgIGxldCBpbkZhbGxiYWNrID0gcHJldi5pbkZhbGxiYWNrO1xuICAgIGNvbnN0IHJlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSByZWcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvbnN0IG4gPSByZXZlcnNlID8gbGVuIC0gaSAtIDEgOiBpLFxuICAgICAgICBzID0gcmVnW25dKCk7XG4gICAgICBpZiAoIXN0b3AgJiYgIXMpIHtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50LFxuICAgICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV4dCA9ICFzdG9wO1xuICAgICAgICBpZiAobmV4dCkgaW5GYWxsYmFjayA9IHRydWU7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudDogbmV4dCxcbiAgICAgICAgICBzaG93RmFsbGJhY2s6ICF0YWlsIHx8IG5leHQgJiYgdGFpbCA9PT0gXCJjb2xsYXBzZWRcIiA/IHNob3dGYWxsYmFjayA6IGZhbHNlXG4gICAgICAgIH07XG4gICAgICAgIHN0b3AgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXN0b3ApIGluRmFsbGJhY2sgPSBmYWxzZTtcbiAgICByZXMuaW5GYWxsYmFjayA9IGluRmFsbGJhY2s7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwge1xuICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gIH0pO1xuICBzZXRXcmFwcGVyKCgpID0+IHJlc29sdmVkKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUxpc3RDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHtcbiAgICAgIHJlZ2lzdGVyOiBpbkZhbGxiYWNrID0+IHtcbiAgICAgICAgbGV0IGluZGV4O1xuICAgICAgICBzZXRSZWdpc3RyeShyZWdpc3RyeSA9PiB7XG4gICAgICAgICAgaW5kZXggPSByZWdpc3RyeS5sZW5ndGg7XG4gICAgICAgICAgcmV0dXJuIFsuLi5yZWdpc3RyeSwgaW5GYWxsYmFja107XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlZCgpW2luZGV4XSwgdW5kZWZpbmVkLCB7XG4gICAgICAgICAgZXF1YWxzOiBzdXNwZW5zZUxpc3RFcXVhbHNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIFN1c3BlbnNlKHByb3BzKSB7XG4gIGxldCBjb3VudGVyID0gMCxcbiAgICBzaG93LFxuICAgIGN0eCxcbiAgICBwLFxuICAgIGZsaWNrZXIsXG4gICAgZXJyb3I7XG4gIGNvbnN0IFtpbkZhbGxiYWNrLCBzZXRGYWxsYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpLFxuICAgIFN1c3BlbnNlQ29udGV4dCA9IGdldFN1c3BlbnNlQ29udGV4dCgpLFxuICAgIHN0b3JlID0ge1xuICAgICAgaW5jcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgrK2NvdW50ZXIgPT09IDEpIHNldEZhbGxiYWNrKHRydWUpO1xuICAgICAgfSxcbiAgICAgIGRlY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoLS1jb3VudGVyID09PSAwKSBzZXRGYWxsYmFjayhmYWxzZSk7XG4gICAgICB9LFxuICAgICAgaW5GYWxsYmFjayxcbiAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgcmVzb2x2ZWQ6IGZhbHNlXG4gICAgfSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkge1xuICAgIGNvbnN0IGtleSA9IHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKTtcbiAgICBsZXQgcmVmID0gc2hhcmVkQ29uZmlnLmxvYWQoa2V5KTtcbiAgICBpZiAocmVmKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZiAhPT0gXCJvYmplY3RcIiB8fCByZWYucyAhPT0gMSkgcCA9IHJlZjtlbHNlIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICB9XG4gICAgaWYgKHAgJiYgcCAhPT0gXCIkJGZcIikge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgZmxpY2tlciA9IHM7XG4gICAgICBwLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBzZXQoKTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzZXQoKTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICBzZXQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGlmIChsaXN0Q29udGV4dCkgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKHN0b3JlLmluRmFsbGJhY2spO1xuICBsZXQgZGlzcG9zZTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UgJiYgZGlzcG9zZSgpKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUNvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZTogc3RvcmUsXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgICAgaWYgKGZsaWNrZXIpIHtcbiAgICAgICAgICBmbGlja2VyKCk7XG4gICAgICAgICAgcmV0dXJuIGZsaWNrZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eCAmJiBwID09PSBcIiQkZlwiKSBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgICBjb25zdCByZW5kZXJlZCA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBpbkZhbGxiYWNrID0gc3RvcmUuaW5GYWxsYmFjaygpLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgICAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge307XG4gICAgICAgICAgaWYgKCghaW5GYWxsYmFjayB8fCBwICYmIHAgIT09IFwiJCRmXCIpICYmIHNob3dDb250ZW50KSB7XG4gICAgICAgICAgICBzdG9yZS5yZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICBkaXNwb3NlICYmIGRpc3Bvc2UoKTtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBjdHggPSBwID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgcmVzdW1lRWZmZWN0cyhzdG9yZS5lZmZlY3RzKTtcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXNob3dGYWxsYmFjaykgcmV0dXJuO1xuICAgICAgICAgIGlmIChkaXNwb3NlKSByZXR1cm4gcHJldjtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlID0gZGlzcG9zZXI7XG4gICAgICAgICAgICBpZiAoY3R4KSB7XG4gICAgICAgICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KHtcbiAgICAgICAgICAgICAgICBpZDogY3R4LmlkICsgXCJGXCIsXG4gICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICAgICAgICB9LCBvd25lcik7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuY29uc3QgREVWID0ge1xuICBob29rczogRGV2SG9va3MsXG4gIHdyaXRlU2lnbmFsLFxuICByZWdpc3RlckdyYXBoXG59IDtcbmlmIChnbG9iYWxUaGlzKSB7XG4gIGlmICghZ2xvYmFsVGhpcy5Tb2xpZCQkKSBnbG9iYWxUaGlzLlNvbGlkJCQgPSB0cnVlO2Vsc2UgY29uc29sZS53YXJuKFwiWW91IGFwcGVhciB0byBoYXZlIG11bHRpcGxlIGluc3RhbmNlcyBvZiBTb2xpZC4gVGhpcyBjYW4gbGVhZCB0byB1bmV4cGVjdGVkIGJlaGF2aW9yLlwiKTtcbn1cblxuZXhwb3J0IHsgJERFVkNPTVAsICRQUk9YWSwgJFRSQUNLLCBERVYsIEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGJhdGNoLCBjYW5jZWxDYWxsYmFjaywgY2F0Y2hFcnJvciwgY2hpbGRyZW4sIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlQ29tcHV0ZWQsIGNyZWF0ZUNvbnRleHQsIGNyZWF0ZURlZmVycmVkLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZU1lbW8sIGNyZWF0ZVJlYWN0aW9uLCBjcmVhdGVSZW5kZXJFZmZlY3QsIGNyZWF0ZVJlc291cmNlLCBjcmVhdGVSb290LCBjcmVhdGVTZWxlY3RvciwgY3JlYXRlU2lnbmFsLCBjcmVhdGVVbmlxdWVJZCwgZW5hYmxlRXh0ZXJuYWxTb3VyY2UsIGVuYWJsZUh5ZHJhdGlvbiwgZW5hYmxlU2NoZWR1bGluZywgZXF1YWxGbiwgZnJvbSwgZ2V0TGlzdGVuZXIsIGdldE93bmVyLCBpbmRleEFycmF5LCBsYXp5LCBtYXBBcnJheSwgbWVyZ2VQcm9wcywgb2JzZXJ2YWJsZSwgb24sIG9uQ2xlYW51cCwgb25FcnJvciwgb25Nb3VudCwgcmVxdWVzdENhbGxiYWNrLCByZXNldEVycm9yQm91bmRhcmllcywgcnVuV2l0aE93bmVyLCBzaGFyZWRDb25maWcsIHNwbGl0UHJvcHMsIHN0YXJ0VHJhbnNpdGlvbiwgdW50cmFjaywgdXNlQ29udGV4dCwgdXNlVHJhbnNpdGlvbiB9O1xuIiwiaW1wb3J0IHsgY3JlYXRlTWVtbywgY3JlYXRlUm9vdCwgY3JlYXRlUmVuZGVyRWZmZWN0LCB1bnRyYWNrLCBzaGFyZWRDb25maWcsIGVuYWJsZUh5ZHJhdGlvbiwgZ2V0T3duZXIsIGNyZWF0ZUVmZmVjdCwgcnVuV2l0aE93bmVyLCBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCwgJERFVkNPTVAsIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcyc7XG5leHBvcnQgeyBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZVJlbmRlckVmZmVjdCBhcyBlZmZlY3QsIGdldE93bmVyLCBtZXJnZVByb3BzLCB1bnRyYWNrIH0gZnJvbSAnc29saWQtanMnO1xuXG5jb25zdCBib29sZWFucyA9IFtcImFsbG93ZnVsbHNjcmVlblwiLCBcImFzeW5jXCIsIFwiYXV0b2ZvY3VzXCIsIFwiYXV0b3BsYXlcIiwgXCJjaGVja2VkXCIsIFwiY29udHJvbHNcIiwgXCJkZWZhdWx0XCIsIFwiZGlzYWJsZWRcIiwgXCJmb3Jtbm92YWxpZGF0ZVwiLCBcImhpZGRlblwiLCBcImluZGV0ZXJtaW5hdGVcIiwgXCJpbmVydFwiLCBcImlzbWFwXCIsIFwibG9vcFwiLCBcIm11bHRpcGxlXCIsIFwibXV0ZWRcIiwgXCJub21vZHVsZVwiLCBcIm5vdmFsaWRhdGVcIiwgXCJvcGVuXCIsIFwicGxheXNpbmxpbmVcIiwgXCJyZWFkb25seVwiLCBcInJlcXVpcmVkXCIsIFwicmV2ZXJzZWRcIiwgXCJzZWFtbGVzc1wiLCBcInNlbGVjdGVkXCJdO1xuY29uc3QgUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImNsYXNzTmFtZVwiLCBcInZhbHVlXCIsIFwicmVhZE9ubHlcIiwgXCJub1ZhbGlkYXRlXCIsIFwiZm9ybU5vVmFsaWRhdGVcIiwgXCJpc01hcFwiLCBcIm5vTW9kdWxlXCIsIFwicGxheXNJbmxpbmVcIiwgLi4uYm9vbGVhbnNdKTtcbmNvbnN0IENoaWxkUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImlubmVySFRNTFwiLCBcInRleHRDb250ZW50XCIsIFwiaW5uZXJUZXh0XCIsIFwiY2hpbGRyZW5cIl0pO1xuY29uc3QgQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3NOYW1lOiBcImNsYXNzXCIsXG4gIGh0bWxGb3I6IFwiZm9yXCJcbn0pO1xuY29uc3QgUHJvcEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzOiBcImNsYXNzTmFtZVwiLFxuICBub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJub1ZhbGlkYXRlXCIsXG4gICAgRk9STTogMVxuICB9LFxuICBmb3Jtbm92YWxpZGF0ZToge1xuICAgICQ6IFwiZm9ybU5vVmFsaWRhdGVcIixcbiAgICBCVVRUT046IDEsXG4gICAgSU5QVVQ6IDFcbiAgfSxcbiAgaXNtYXA6IHtcbiAgICAkOiBcImlzTWFwXCIsXG4gICAgSU1HOiAxXG4gIH0sXG4gIG5vbW9kdWxlOiB7XG4gICAgJDogXCJub01vZHVsZVwiLFxuICAgIFNDUklQVDogMVxuICB9LFxuICBwbGF5c2lubGluZToge1xuICAgICQ6IFwicGxheXNJbmxpbmVcIixcbiAgICBWSURFTzogMVxuICB9LFxuICByZWFkb25seToge1xuICAgICQ6IFwicmVhZE9ubHlcIixcbiAgICBJTlBVVDogMSxcbiAgICBURVhUQVJFQTogMVxuICB9XG59KTtcbmZ1bmN0aW9uIGdldFByb3BBbGlhcyhwcm9wLCB0YWdOYW1lKSB7XG4gIGNvbnN0IGEgPSBQcm9wQWxpYXNlc1twcm9wXTtcbiAgcmV0dXJuIHR5cGVvZiBhID09PSBcIm9iamVjdFwiID8gYVt0YWdOYW1lXSA/IGFbXCIkXCJdIDogdW5kZWZpbmVkIDogYTtcbn1cbmNvbnN0IERlbGVnYXRlZEV2ZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImJlZm9yZWlucHV0XCIsIFwiY2xpY2tcIiwgXCJkYmxjbGlja1wiLCBcImNvbnRleHRtZW51XCIsIFwiZm9jdXNpblwiLCBcImZvY3Vzb3V0XCIsIFwiaW5wdXRcIiwgXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJtb3VzZWRvd25cIiwgXCJtb3VzZW1vdmVcIiwgXCJtb3VzZW91dFwiLCBcIm1vdXNlb3ZlclwiLCBcIm1vdXNldXBcIiwgXCJwb2ludGVyZG93blwiLCBcInBvaW50ZXJtb3ZlXCIsIFwicG9pbnRlcm91dFwiLCBcInBvaW50ZXJvdmVyXCIsIFwicG9pbnRlcnVwXCIsIFwidG91Y2hlbmRcIiwgXCJ0b3VjaG1vdmVcIiwgXCJ0b3VjaHN0YXJ0XCJdKTtcbmNvbnN0IFNWR0VsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1xuXCJhbHRHbHlwaFwiLCBcImFsdEdseXBoRGVmXCIsIFwiYWx0R2x5cGhJdGVtXCIsIFwiYW5pbWF0ZVwiLCBcImFuaW1hdGVDb2xvclwiLCBcImFuaW1hdGVNb3Rpb25cIiwgXCJhbmltYXRlVHJhbnNmb3JtXCIsIFwiY2lyY2xlXCIsIFwiY2xpcFBhdGhcIiwgXCJjb2xvci1wcm9maWxlXCIsIFwiY3Vyc29yXCIsIFwiZGVmc1wiLCBcImRlc2NcIiwgXCJlbGxpcHNlXCIsIFwiZmVCbGVuZFwiLCBcImZlQ29sb3JNYXRyaXhcIiwgXCJmZUNvbXBvbmVudFRyYW5zZmVyXCIsIFwiZmVDb21wb3NpdGVcIiwgXCJmZUNvbnZvbHZlTWF0cml4XCIsIFwiZmVEaWZmdXNlTGlnaHRpbmdcIiwgXCJmZURpc3BsYWNlbWVudE1hcFwiLCBcImZlRGlzdGFudExpZ2h0XCIsIFwiZmVEcm9wU2hhZG93XCIsIFwiZmVGbG9vZFwiLCBcImZlRnVuY0FcIiwgXCJmZUZ1bmNCXCIsIFwiZmVGdW5jR1wiLCBcImZlRnVuY1JcIiwgXCJmZUdhdXNzaWFuQmx1clwiLCBcImZlSW1hZ2VcIiwgXCJmZU1lcmdlXCIsIFwiZmVNZXJnZU5vZGVcIiwgXCJmZU1vcnBob2xvZ3lcIiwgXCJmZU9mZnNldFwiLCBcImZlUG9pbnRMaWdodFwiLCBcImZlU3BlY3VsYXJMaWdodGluZ1wiLCBcImZlU3BvdExpZ2h0XCIsIFwiZmVUaWxlXCIsIFwiZmVUdXJidWxlbmNlXCIsIFwiZmlsdGVyXCIsIFwiZm9udFwiLCBcImZvbnQtZmFjZVwiLCBcImZvbnQtZmFjZS1mb3JtYXRcIiwgXCJmb250LWZhY2UtbmFtZVwiLCBcImZvbnQtZmFjZS1zcmNcIiwgXCJmb250LWZhY2UtdXJpXCIsIFwiZm9yZWlnbk9iamVjdFwiLCBcImdcIiwgXCJnbHlwaFwiLCBcImdseXBoUmVmXCIsIFwiaGtlcm5cIiwgXCJpbWFnZVwiLCBcImxpbmVcIiwgXCJsaW5lYXJHcmFkaWVudFwiLCBcIm1hcmtlclwiLCBcIm1hc2tcIiwgXCJtZXRhZGF0YVwiLCBcIm1pc3NpbmctZ2x5cGhcIiwgXCJtcGF0aFwiLCBcInBhdGhcIiwgXCJwYXR0ZXJuXCIsIFwicG9seWdvblwiLCBcInBvbHlsaW5lXCIsIFwicmFkaWFsR3JhZGllbnRcIiwgXCJyZWN0XCIsXG5cInNldFwiLCBcInN0b3BcIixcblwic3ZnXCIsIFwic3dpdGNoXCIsIFwic3ltYm9sXCIsIFwidGV4dFwiLCBcInRleHRQYXRoXCIsXG5cInRyZWZcIiwgXCJ0c3BhblwiLCBcInVzZVwiLCBcInZpZXdcIiwgXCJ2a2VyblwiXSk7XG5jb25zdCBTVkdOYW1lc3BhY2UgPSB7XG4gIHhsaW5rOiBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIixcbiAgeG1sOiBcImh0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZVwiXG59O1xuY29uc3QgRE9NRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJodG1sXCIsIFwiYmFzZVwiLCBcImhlYWRcIiwgXCJsaW5rXCIsIFwibWV0YVwiLCBcInN0eWxlXCIsIFwidGl0bGVcIiwgXCJib2R5XCIsIFwiYWRkcmVzc1wiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImZvb3RlclwiLCBcImhlYWRlclwiLCBcIm1haW5cIiwgXCJuYXZcIiwgXCJzZWN0aW9uXCIsIFwiYm9keVwiLCBcImJsb2NrcXVvdGVcIiwgXCJkZFwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiaHJcIiwgXCJsaVwiLCBcIm9sXCIsIFwicFwiLCBcInByZVwiLCBcInVsXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJiXCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYnJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImRhdGFcIiwgXCJkZm5cIiwgXCJlbVwiLCBcImlcIiwgXCJrYmRcIiwgXCJtYXJrXCIsIFwicVwiLCBcInJwXCIsIFwicnRcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzbWFsbFwiLCBcInNwYW5cIiwgXCJzdHJvbmdcIiwgXCJzdWJcIiwgXCJzdXBcIiwgXCJ0aW1lXCIsIFwidVwiLCBcInZhclwiLCBcIndiclwiLCBcImFyZWFcIiwgXCJhdWRpb1wiLCBcImltZ1wiLCBcIm1hcFwiLCBcInRyYWNrXCIsIFwidmlkZW9cIiwgXCJlbWJlZFwiLCBcImlmcmFtZVwiLCBcIm9iamVjdFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBvcnRhbFwiLCBcInNvdXJjZVwiLCBcInN2Z1wiLCBcIm1hdGhcIiwgXCJjYW52YXNcIiwgXCJub3NjcmlwdFwiLCBcInNjcmlwdFwiLCBcImRlbFwiLCBcImluc1wiLCBcImNhcHRpb25cIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRyXCIsIFwiYnV0dG9uXCIsIFwiZGF0YWxpc3RcIiwgXCJmaWVsZHNldFwiLCBcImZvcm1cIiwgXCJpbnB1dFwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibWV0ZXJcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInByb2dyZXNzXCIsIFwic2VsZWN0XCIsIFwidGV4dGFyZWFcIiwgXCJkZXRhaWxzXCIsIFwiZGlhbG9nXCIsIFwibWVudVwiLCBcInN1bW1hcnlcIiwgXCJkZXRhaWxzXCIsIFwic2xvdFwiLCBcInRlbXBsYXRlXCIsIFwiYWNyb255bVwiLCBcImFwcGxldFwiLCBcImJhc2Vmb250XCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiY2VudGVyXCIsIFwiY29udGVudFwiLCBcImRpclwiLCBcImZvbnRcIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGdyb3VwXCIsIFwiaW1hZ2VcIiwgXCJrZXlnZW5cIiwgXCJtYXJxdWVlXCIsIFwibWVudWl0ZW1cIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwicGxhaW50ZXh0XCIsIFwicmJcIiwgXCJydGNcIiwgXCJzaGFkb3dcIiwgXCJzcGFjZXJcIiwgXCJzdHJpa2VcIiwgXCJ0dFwiLCBcInhtcFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYWNyb255bVwiLCBcImFkZHJlc3NcIiwgXCJhcHBsZXRcIiwgXCJhcmVhXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiYXVkaW9cIiwgXCJiXCIsIFwiYmFzZVwiLCBcImJhc2Vmb250XCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiYmxvY2txdW90ZVwiLCBcImJvZHlcIiwgXCJiclwiLCBcImJ1dHRvblwiLCBcImNhbnZhc1wiLCBcImNhcHRpb25cIiwgXCJjZW50ZXJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwiY29udGVudFwiLCBcImRhdGFcIiwgXCJkYXRhbGlzdFwiLCBcImRkXCIsIFwiZGVsXCIsIFwiZGV0YWlsc1wiLCBcImRmblwiLCBcImRpYWxvZ1wiLCBcImRpclwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJlbVwiLCBcImVtYmVkXCIsIFwiZmllbGRzZXRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiZm9udFwiLCBcImZvb3RlclwiLCBcImZvcm1cIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGVhZFwiLCBcImhlYWRlclwiLCBcImhncm91cFwiLCBcImhyXCIsIFwiaHRtbFwiLCBcImlcIiwgXCJpZnJhbWVcIiwgXCJpbWFnZVwiLCBcImltZ1wiLCBcImlucHV0XCIsIFwiaW5zXCIsIFwia2JkXCIsIFwia2V5Z2VuXCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJsaVwiLCBcImxpbmtcIiwgXCJtYWluXCIsIFwibWFwXCIsIFwibWFya1wiLCBcIm1hcnF1ZWVcIiwgXCJtZW51XCIsIFwibWVudWl0ZW1cIiwgXCJtZXRhXCIsIFwibWV0ZXJcIiwgXCJuYXZcIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwibm9zY3JpcHRcIiwgXCJvYmplY3RcIiwgXCJvbFwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBsYWludGV4dFwiLCBcInBvcnRhbFwiLCBcInByZVwiLCBcInByb2dyZXNzXCIsIFwicVwiLCBcInJiXCIsIFwicnBcIiwgXCJydFwiLCBcInJ0Y1wiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNjcmlwdFwiLCBcInNlY3Rpb25cIiwgXCJzZWxlY3RcIiwgXCJzaGFkb3dcIiwgXCJzbG90XCIsIFwic21hbGxcIiwgXCJzb3VyY2VcIiwgXCJzcGFjZXJcIiwgXCJzcGFuXCIsIFwic3RyaWtlXCIsIFwic3Ryb25nXCIsIFwic3R5bGVcIiwgXCJzdWJcIiwgXCJzdW1tYXJ5XCIsIFwic3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGVtcGxhdGVcIiwgXCJ0ZXh0YXJlYVwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRpbWVcIiwgXCJ0aXRsZVwiLCBcInRyXCIsIFwidHJhY2tcIiwgXCJ0dFwiLCBcInVcIiwgXCJ1bFwiLCBcInZhclwiLCBcInZpZGVvXCIsIFwid2JyXCIsIFwieG1wXCIsIFwiaW5wdXRcIiwgXCJoMVwiLCBcImgyXCIsIFwiaDNcIiwgXCJoNFwiLCBcImg1XCIsIFwiaDZcIl0pO1xuXG5jb25zdCBtZW1vID0gZm4gPT4gY3JlYXRlTWVtbygoKSA9PiBmbigpKTtcblxuZnVuY3Rpb24gcmVjb25jaWxlQXJyYXlzKHBhcmVudE5vZGUsIGEsIGIpIHtcbiAgbGV0IGJMZW5ndGggPSBiLmxlbmd0aCxcbiAgICBhRW5kID0gYS5sZW5ndGgsXG4gICAgYkVuZCA9IGJMZW5ndGgsXG4gICAgYVN0YXJ0ID0gMCxcbiAgICBiU3RhcnQgPSAwLFxuICAgIGFmdGVyID0gYVthRW5kIC0gMV0ubmV4dFNpYmxpbmcsXG4gICAgbWFwID0gbnVsbDtcbiAgd2hpbGUgKGFTdGFydCA8IGFFbmQgfHwgYlN0YXJ0IDwgYkVuZCkge1xuICAgIGlmIChhW2FTdGFydF0gPT09IGJbYlN0YXJ0XSkge1xuICAgICAgYVN0YXJ0Kys7XG4gICAgICBiU3RhcnQrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB3aGlsZSAoYVthRW5kIC0gMV0gPT09IGJbYkVuZCAtIDFdKSB7XG4gICAgICBhRW5kLS07XG4gICAgICBiRW5kLS07XG4gICAgfVxuICAgIGlmIChhRW5kID09PSBhU3RhcnQpIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBiRW5kIDwgYkxlbmd0aCA/IGJTdGFydCA/IGJbYlN0YXJ0IC0gMV0ubmV4dFNpYmxpbmcgOiBiW2JFbmQgLSBiU3RhcnRdIDogYWZ0ZXI7XG4gICAgICB3aGlsZSAoYlN0YXJ0IDwgYkVuZCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoYkVuZCA9PT0gYlN0YXJ0KSB7XG4gICAgICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCkge1xuICAgICAgICBpZiAoIW1hcCB8fCAhbWFwLmhhcyhhW2FTdGFydF0pKSBhW2FTdGFydF0ucmVtb3ZlKCk7XG4gICAgICAgIGFTdGFydCsrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYVthU3RhcnRdID09PSBiW2JFbmQgLSAxXSAmJiBiW2JTdGFydF0gPT09IGFbYUVuZCAtIDFdKSB7XG4gICAgICBjb25zdCBub2RlID0gYVstLWFFbmRdLm5leHRTaWJsaW5nO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdLm5leHRTaWJsaW5nKTtcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbLS1iRW5kXSwgbm9kZSk7XG4gICAgICBhW2FFbmRdID0gYltiRW5kXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQgaSA9IGJTdGFydDtcbiAgICAgICAgd2hpbGUgKGkgPCBiRW5kKSBtYXAuc2V0KGJbaV0sIGkrKyk7XG4gICAgICB9XG4gICAgICBjb25zdCBpbmRleCA9IG1hcC5nZXQoYVthU3RhcnRdKTtcbiAgICAgIGlmIChpbmRleCAhPSBudWxsKSB7XG4gICAgICAgIGlmIChiU3RhcnQgPCBpbmRleCAmJiBpbmRleCA8IGJFbmQpIHtcbiAgICAgICAgICBsZXQgaSA9IGFTdGFydCxcbiAgICAgICAgICAgIHNlcXVlbmNlID0gMSxcbiAgICAgICAgICAgIHQ7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGFFbmQgJiYgaSA8IGJFbmQpIHtcbiAgICAgICAgICAgIGlmICgodCA9IG1hcC5nZXQoYVtpXSkpID09IG51bGwgfHwgdCAhPT0gaW5kZXggKyBzZXF1ZW5jZSkgYnJlYWs7XG4gICAgICAgICAgICBzZXF1ZW5jZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VxdWVuY2UgPiBpbmRleCAtIGJTdGFydCkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGFbYVN0YXJ0XTtcbiAgICAgICAgICAgIHdoaWxlIChiU3RhcnQgPCBpbmRleCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgICAgICAgIH0gZWxzZSBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChiW2JTdGFydCsrXSwgYVthU3RhcnQrK10pO1xuICAgICAgICB9IGVsc2UgYVN0YXJ0Kys7XG4gICAgICB9IGVsc2UgYVthU3RhcnQrK10ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0ICQkRVZFTlRTID0gXCJfJERYX0RFTEVHQVRFXCI7XG5mdW5jdGlvbiByZW5kZXIoY29kZSwgZWxlbWVudCwgaW5pdCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBgZWxlbWVudGAgcGFzc2VkIHRvIGByZW5kZXIoLi4uLCBlbGVtZW50KWAgZG9lc24ndCBleGlzdC4gTWFrZSBzdXJlIGBlbGVtZW50YCBleGlzdHMgaW4gdGhlIGRvY3VtZW50LlwiKTtcbiAgfVxuICBsZXQgZGlzcG9zZXI7XG4gIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiB7XG4gICAgZGlzcG9zZXIgPSBkaXNwb3NlO1xuICAgIGVsZW1lbnQgPT09IGRvY3VtZW50ID8gY29kZSgpIDogaW5zZXJ0KGVsZW1lbnQsIGNvZGUoKSwgZWxlbWVudC5maXJzdENoaWxkID8gbnVsbCA6IHVuZGVmaW5lZCwgaW5pdCk7XG4gIH0sIG9wdGlvbnMub3duZXIpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGRpc3Bvc2VyKCk7XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIH07XG59XG5mdW5jdGlvbiB0ZW1wbGF0ZShodG1sLCBpc0ltcG9ydE5vZGUsIGlzU1ZHLCBpc01hdGhNTCkge1xuICBsZXQgbm9kZTtcbiAgY29uc3QgY3JlYXRlID0gKCkgPT4ge1xuICAgIGlmIChpc0h5ZHJhdGluZygpKSB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgYXR0ZW1wdCB0byBjcmVhdGUgbmV3IERPTSBlbGVtZW50cyBkdXJpbmcgaHlkcmF0aW9uLiBDaGVjayB0aGF0IHRoZSBsaWJyYXJpZXMgeW91IGFyZSB1c2luZyBzdXBwb3J0IGh5ZHJhdGlvbi5cIik7XG4gICAgY29uc3QgdCA9IGlzTWF0aE1MID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTFwiLCBcInRlbXBsYXRlXCIpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpO1xuICAgIHQuaW5uZXJIVE1MID0gaHRtbDtcbiAgICByZXR1cm4gaXNTVkcgPyB0LmNvbnRlbnQuZmlyc3RDaGlsZC5maXJzdENoaWxkIDogaXNNYXRoTUwgPyB0LmZpcnN0Q2hpbGQgOiB0LmNvbnRlbnQuZmlyc3RDaGlsZDtcbiAgfTtcbiAgY29uc3QgZm4gPSBpc0ltcG9ydE5vZGUgPyAoKSA9PiB1bnRyYWNrKCgpID0+IGRvY3VtZW50LmltcG9ydE5vZGUobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSwgdHJ1ZSkpIDogKCkgPT4gKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSkpLmNsb25lTm9kZSh0cnVlKTtcbiAgZm4uY2xvbmVOb2RlID0gZm47XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGRlbGVnYXRlRXZlbnRzKGV2ZW50TmFtZXMsIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGNvbnN0IGUgPSBkb2N1bWVudFskJEVWRU5UU10gfHwgKGRvY3VtZW50WyQkRVZFTlRTXSA9IG5ldyBTZXQoKSk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gZXZlbnROYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb25zdCBuYW1lID0gZXZlbnROYW1lc1tpXTtcbiAgICBpZiAoIWUuaGFzKG5hbWUpKSB7XG4gICAgICBlLmFkZChuYW1lKTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFyRGVsZWdhdGVkRXZlbnRzKGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGlmIChkb2N1bWVudFskJEVWRU5UU10pIHtcbiAgICBmb3IgKGxldCBuYW1lIG9mIGRvY3VtZW50WyQkRVZFTlRTXS5rZXlzKCkpIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICBkZWxldGUgZG9jdW1lbnRbJCRFVkVOVFNdO1xuICB9XG59XG5mdW5jdGlvbiBzZXRQcm9wZXJ0eShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgbm9kZVtuYW1lXSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGVOUyhub2RlLCBuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIHZhbHVlID8gbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgXCJcIikgOiBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTmFtZShub2RlLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKFwiY2xhc3NcIik7ZWxzZSBub2RlLmNsYXNzTmFtZSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCBoYW5kbGVyLCBkZWxlZ2F0ZSkge1xuICBpZiAoZGVsZWdhdGUpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgICAgbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyWzBdO1xuICAgICAgbm9kZVtgJCQke25hbWV9RGF0YWBdID0gaGFuZGxlclsxXTtcbiAgICB9IGVsc2Ugbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyO1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICBjb25zdCBoYW5kbGVyRm4gPSBoYW5kbGVyWzBdO1xuICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyWzBdID0gZSA9PiBoYW5kbGVyRm4uY2FsbChub2RlLCBoYW5kbGVyWzFdLCBlKSk7XG4gIH0gZWxzZSBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlciwgdHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIiAmJiBoYW5kbGVyKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldiA9IHt9KSB7XG4gIGNvbnN0IGNsYXNzS2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlIHx8IHt9KSxcbiAgICBwcmV2S2V5cyA9IE9iamVjdC5rZXlzKHByZXYpO1xuICBsZXQgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBwcmV2S2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHByZXZLZXlzW2ldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCB2YWx1ZVtrZXldKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIGZhbHNlKTtcbiAgICBkZWxldGUgcHJldltrZXldO1xuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGNsYXNzS2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGNsYXNzS2V5c1tpXSxcbiAgICAgIGNsYXNzVmFsdWUgPSAhIXZhbHVlW2tleV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHByZXZba2V5XSA9PT0gY2xhc3NWYWx1ZSB8fCAhY2xhc3NWYWx1ZSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB0cnVlKTtcbiAgICBwcmV2W2tleV0gPSBjbGFzc1ZhbHVlO1xuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpIHtcbiAgaWYgKCF2YWx1ZSkgcmV0dXJuIHByZXYgPyBzZXRBdHRyaWJ1dGUobm9kZSwgXCJzdHlsZVwiKSA6IHZhbHVlO1xuICBjb25zdCBub2RlU3R5bGUgPSBub2RlLnN0eWxlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSByZXR1cm4gbm9kZVN0eWxlLmNzc1RleHQgPSB2YWx1ZTtcbiAgdHlwZW9mIHByZXYgPT09IFwic3RyaW5nXCIgJiYgKG5vZGVTdHlsZS5jc3NUZXh0ID0gcHJldiA9IHVuZGVmaW5lZCk7XG4gIHByZXYgfHwgKHByZXYgPSB7fSk7XG4gIHZhbHVlIHx8ICh2YWx1ZSA9IHt9KTtcbiAgbGV0IHYsIHM7XG4gIGZvciAocyBpbiBwcmV2KSB7XG4gICAgdmFsdWVbc10gPT0gbnVsbCAmJiBub2RlU3R5bGUucmVtb3ZlUHJvcGVydHkocyk7XG4gICAgZGVsZXRlIHByZXZbc107XG4gIH1cbiAgZm9yIChzIGluIHZhbHVlKSB7XG4gICAgdiA9IHZhbHVlW3NdO1xuICAgIGlmICh2ICE9PSBwcmV2W3NdKSB7XG4gICAgICBub2RlU3R5bGUuc2V0UHJvcGVydHkocywgdik7XG4gICAgICBwcmV2W3NdID0gdjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzcHJlYWQobm9kZSwgcHJvcHMgPSB7fSwgaXNTVkcsIHNraXBDaGlsZHJlbikge1xuICBjb25zdCBwcmV2UHJvcHMgPSB7fTtcbiAgaWYgKCFza2lwQ2hpbGRyZW4pIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcHJldlByb3BzLmNoaWxkcmVuID0gaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbiwgcHJldlByb3BzLmNoaWxkcmVuKSk7XG4gIH1cbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHR5cGVvZiBwcm9wcy5yZWYgPT09IFwiZnVuY3Rpb25cIiAmJiB1c2UocHJvcHMucmVmLCBub2RlKSk7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCB0cnVlLCBwcmV2UHJvcHMsIHRydWUpKTtcbiAgcmV0dXJuIHByZXZQcm9wcztcbn1cbmZ1bmN0aW9uIGR5bmFtaWNQcm9wZXJ0eShwcm9wcywga2V5KSB7XG4gIGNvbnN0IHNyYyA9IHByb3BzW2tleV07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywga2V5LCB7XG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIHNyYygpO1xuICAgIH0sXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIHByb3BzO1xufVxuZnVuY3Rpb24gdXNlKGZuLCBlbGVtZW50LCBhcmcpIHtcbiAgcmV0dXJuIHVudHJhY2soKCkgPT4gZm4oZWxlbWVudCwgYXJnKSk7XG59XG5mdW5jdGlvbiBpbnNlcnQocGFyZW50LCBhY2Nlc3NvciwgbWFya2VyLCBpbml0aWFsKSB7XG4gIGlmIChtYXJrZXIgIT09IHVuZGVmaW5lZCAmJiAhaW5pdGlhbCkgaW5pdGlhbCA9IFtdO1xuICBpZiAodHlwZW9mIGFjY2Vzc29yICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IsIGluaXRpYWwsIG1hcmtlcik7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdChjdXJyZW50ID0+IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvcigpLCBjdXJyZW50LCBtYXJrZXIpLCBpbml0aWFsKTtcbn1cbmZ1bmN0aW9uIGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbiwgcHJldlByb3BzID0ge30sIHNraXBSZWYgPSBmYWxzZSkge1xuICBwcm9wcyB8fCAocHJvcHMgPSB7fSk7XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcmV2UHJvcHMpIHtcbiAgICBpZiAoIShwcm9wIGluIHByb3BzKSkge1xuICAgICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikgY29udGludWU7XG4gICAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIG51bGwsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwcm9wIGluIHByb3BzKSB7XG4gICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikge1xuICAgICAgaWYgKCFza2lwQ2hpbGRyZW4pIGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcHJvcHNbcHJvcF07XG4gICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICB9XG59XG5mdW5jdGlvbiBoeWRyYXRlJDEoY29kZSwgZWxlbWVudCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmIChnbG9iYWxUaGlzLl8kSFkuZG9uZSkgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBnbG9iYWxUaGlzLl8kSFkuY29tcGxldGVkO1xuICBzaGFyZWRDb25maWcuZXZlbnRzID0gZ2xvYmFsVGhpcy5fJEhZLmV2ZW50cztcbiAgc2hhcmVkQ29uZmlnLmxvYWQgPSBpZCA9PiBnbG9iYWxUaGlzLl8kSFkucltpZF07XG4gIHNoYXJlZENvbmZpZy5oYXMgPSBpZCA9PiBpZCBpbiBnbG9iYWxUaGlzLl8kSFkucjtcbiAgc2hhcmVkQ29uZmlnLmdhdGhlciA9IHJvb3QgPT4gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IHtcbiAgICBpZDogb3B0aW9ucy5yZW5kZXJJZCB8fCBcIlwiLFxuICAgIGNvdW50OiAwXG4gIH07XG4gIHRyeSB7XG4gICAgZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCBvcHRpb25zLnJlbmRlcklkKTtcbiAgICByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzaGFyZWRDb25maWcuY29udGV4dCA9IG51bGw7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldE5leHRFbGVtZW50KHRlbXBsYXRlKSB7XG4gIGxldCBub2RlLFxuICAgIGtleSxcbiAgICBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZygpO1xuICBpZiAoIWh5ZHJhdGluZyB8fCAhKG5vZGUgPSBzaGFyZWRDb25maWcucmVnaXN0cnkuZ2V0KGtleSA9IGdldEh5ZHJhdGlvbktleSgpKSkpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBzaGFyZWRDb25maWcuZG9uZSA9IHRydWU7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEh5ZHJhdGlvbiBNaXNtYXRjaC4gVW5hYmxlIHRvIGZpbmQgRE9NIG5vZGVzIGZvciBoeWRyYXRpb24ga2V5OiAke2tleX1cXG4ke3RlbXBsYXRlID8gdGVtcGxhdGUoKS5vdXRlckhUTUwgOiBcIlwifWApO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGUoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCkgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZC5hZGQobm9kZSk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5kZWxldGUoa2V5KTtcbiAgcmV0dXJuIG5vZGU7XG59XG5mdW5jdGlvbiBnZXROZXh0TWF0Y2goZWwsIG5vZGVOYW1lKSB7XG4gIHdoaWxlIChlbCAmJiBlbC5sb2NhbE5hbWUgIT09IG5vZGVOYW1lKSBlbCA9IGVsLm5leHRTaWJsaW5nO1xuICByZXR1cm4gZWw7XG59XG5mdW5jdGlvbiBnZXROZXh0TWFya2VyKHN0YXJ0KSB7XG4gIGxldCBlbmQgPSBzdGFydCxcbiAgICBjb3VudCA9IDAsXG4gICAgY3VycmVudCA9IFtdO1xuICBpZiAoaXNIeWRyYXRpbmcoc3RhcnQpKSB7XG4gICAgd2hpbGUgKGVuZCkge1xuICAgICAgaWYgKGVuZC5ub2RlVHlwZSA9PT0gOCkge1xuICAgICAgICBjb25zdCB2ID0gZW5kLm5vZGVWYWx1ZTtcbiAgICAgICAgaWYgKHYgPT09IFwiJFwiKSBjb3VudCsrO2Vsc2UgaWYgKHYgPT09IFwiL1wiKSB7XG4gICAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXR1cm4gW2VuZCwgY3VycmVudF07XG4gICAgICAgICAgY291bnQtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY3VycmVudC5wdXNoKGVuZCk7XG4gICAgICBlbmQgPSBlbmQubmV4dFNpYmxpbmc7XG4gICAgfVxuICB9XG4gIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbn1cbmZ1bmN0aW9uIHJ1bkh5ZHJhdGlvbkV2ZW50cygpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMgJiYgIXNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgY29uc3Qge1xuICAgICAgICBjb21wbGV0ZWQsXG4gICAgICAgIGV2ZW50c1xuICAgICAgfSA9IHNoYXJlZENvbmZpZztcbiAgICAgIGlmICghZXZlbnRzKSByZXR1cm47XG4gICAgICBldmVudHMucXVldWVkID0gZmFsc2U7XG4gICAgICB3aGlsZSAoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBbZWwsIGVdID0gZXZlbnRzWzBdO1xuICAgICAgICBpZiAoIWNvbXBsZXRlZC5oYXMoZWwpKSByZXR1cm47XG4gICAgICAgIGV2ZW50cy5zaGlmdCgpO1xuICAgICAgICBldmVudEhhbmRsZXIoZSk7XG4gICAgICB9XG4gICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IF8kSFkuZXZlbnRzID0gbnVsbDtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IF8kSFkuY29tcGxldGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCA9IHRydWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzSHlkcmF0aW5nKG5vZGUpIHtcbiAgcmV0dXJuICEhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgIXNoYXJlZENvbmZpZy5kb25lICYmICghbm9kZSB8fCBub2RlLmlzQ29ubmVjdGVkKTtcbn1cbmZ1bmN0aW9uIHRvUHJvcGVydHlOYW1lKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC8tKFthLXpdKS9nLCAoXywgdykgPT4gdy50b1VwcGVyQ2FzZSgpKTtcbn1cbmZ1bmN0aW9uIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdmFsdWUpIHtcbiAgY29uc3QgY2xhc3NOYW1lcyA9IGtleS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgZm9yIChsZXQgaSA9IDAsIG5hbWVMZW4gPSBjbGFzc05hbWVzLmxlbmd0aDsgaSA8IG5hbWVMZW47IGkrKykgbm9kZS5jbGFzc0xpc3QudG9nZ2xlKGNsYXNzTmFtZXNbaV0sIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXYsIGlzU1ZHLCBza2lwUmVmLCBwcm9wcykge1xuICBsZXQgaXNDRSwgaXNQcm9wLCBpc0NoaWxkUHJvcCwgcHJvcEFsaWFzLCBmb3JjZVByb3A7XG4gIGlmIChwcm9wID09PSBcInN0eWxlXCIpIHJldHVybiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmIChwcm9wID09PSBcImNsYXNzTGlzdFwiKSByZXR1cm4gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHZhbHVlID09PSBwcmV2KSByZXR1cm4gcHJldjtcbiAgaWYgKHByb3AgPT09IFwicmVmXCIpIHtcbiAgICBpZiAoIXNraXBSZWYpIHZhbHVlKG5vZGUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMykgPT09IFwib246XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgzKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0eXBlb2YgcHJldiAhPT0gXCJmdW5jdGlvblwiICYmIHByZXYpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIgJiYgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMTApID09PSBcIm9uY2FwdHVyZTpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDEwKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0cnVlKTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHRydWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMikgPT09IFwib25cIikge1xuICAgIGNvbnN0IG5hbWUgPSBwcm9wLnNsaWNlKDIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZGVsZWdhdGUgPSBEZWxlZ2F0ZWRFdmVudHMuaGFzKG5hbWUpO1xuICAgIGlmICghZGVsZWdhdGUgJiYgcHJldikge1xuICAgICAgY29uc3QgaCA9IEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2WzBdIDogcHJldjtcbiAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBoKTtcbiAgICB9XG4gICAgaWYgKGRlbGVnYXRlIHx8IHZhbHVlKSB7XG4gICAgICBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIHZhbHVlLCBkZWxlZ2F0ZSk7XG4gICAgICBkZWxlZ2F0ZSAmJiBkZWxlZ2F0ZUV2ZW50cyhbbmFtZV0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImF0dHI6XCIpIHtcbiAgICBzZXRBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYm9vbDpcIikge1xuICAgIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKChmb3JjZVByb3AgPSBwcm9wLnNsaWNlKDAsIDUpID09PSBcInByb3A6XCIpIHx8IChpc0NoaWxkUHJvcCA9IENoaWxkUHJvcGVydGllcy5oYXMocHJvcCkpIHx8ICFpc1NWRyAmJiAoKHByb3BBbGlhcyA9IGdldFByb3BBbGlhcyhwcm9wLCBub2RlLnRhZ05hbWUpKSB8fCAoaXNQcm9wID0gUHJvcGVydGllcy5oYXMocHJvcCkpKSB8fCAoaXNDRSA9IG5vZGUubm9kZU5hbWUuaW5jbHVkZXMoXCItXCIpIHx8IFwiaXNcIiBpbiBwcm9wcykpIHtcbiAgICBpZiAoZm9yY2VQcm9wKSB7XG4gICAgICBwcm9wID0gcHJvcC5zbGljZSg1KTtcbiAgICAgIGlzUHJvcCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuIHZhbHVlO1xuICAgIGlmIChwcm9wID09PSBcImNsYXNzXCIgfHwgcHJvcCA9PT0gXCJjbGFzc05hbWVcIikgY2xhc3NOYW1lKG5vZGUsIHZhbHVlKTtlbHNlIGlmIChpc0NFICYmICFpc1Byb3AgJiYgIWlzQ2hpbGRQcm9wKSBub2RlW3RvUHJvcGVydHlOYW1lKHByb3ApXSA9IHZhbHVlO2Vsc2Ugbm9kZVtwcm9wQWxpYXMgfHwgcHJvcF0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBucyA9IGlzU1ZHICYmIHByb3AuaW5kZXhPZihcIjpcIikgPiAtMSAmJiBTVkdOYW1lc3BhY2VbcHJvcC5zcGxpdChcIjpcIilbMF1dO1xuICAgIGlmIChucykgc2V0QXR0cmlidXRlTlMobm9kZSwgbnMsIHByb3AsIHZhbHVlKTtlbHNlIHNldEF0dHJpYnV0ZShub2RlLCBBbGlhc2VzW3Byb3BdIHx8IHByb3AsIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBldmVudEhhbmRsZXIoZSkge1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmIHNoYXJlZENvbmZpZy5ldmVudHMpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cy5maW5kKChbZWwsIGV2XSkgPT4gZXYgPT09IGUpKSByZXR1cm47XG4gIH1cbiAgbGV0IG5vZGUgPSBlLnRhcmdldDtcbiAgY29uc3Qga2V5ID0gYCQkJHtlLnR5cGV9YDtcbiAgY29uc3Qgb3JpVGFyZ2V0ID0gZS50YXJnZXQ7XG4gIGNvbnN0IG9yaUN1cnJlbnRUYXJnZXQgPSBlLmN1cnJlbnRUYXJnZXQ7XG4gIGNvbnN0IHJldGFyZ2V0ID0gdmFsdWUgPT4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwidGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgdmFsdWVcbiAgfSk7XG4gIGNvbnN0IGhhbmRsZU5vZGUgPSAoKSA9PiB7XG4gICAgY29uc3QgaGFuZGxlciA9IG5vZGVba2V5XTtcbiAgICBpZiAoaGFuZGxlciAmJiAhbm9kZS5kaXNhYmxlZCkge1xuICAgICAgY29uc3QgZGF0YSA9IG5vZGVbYCR7a2V5fURhdGFgXTtcbiAgICAgIGRhdGEgIT09IHVuZGVmaW5lZCA/IGhhbmRsZXIuY2FsbChub2RlLCBkYXRhLCBlKSA6IGhhbmRsZXIuY2FsbChub2RlLCBlKTtcbiAgICAgIGlmIChlLmNhbmNlbEJ1YmJsZSkgcmV0dXJuO1xuICAgIH1cbiAgICBub2RlLmhvc3QgJiYgdHlwZW9mIG5vZGUuaG9zdCAhPT0gXCJzdHJpbmdcIiAmJiAhbm9kZS5ob3N0Ll8kaG9zdCAmJiBub2RlLmNvbnRhaW5zKGUudGFyZ2V0KSAmJiByZXRhcmdldChub2RlLmhvc3QpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuICBjb25zdCB3YWxrVXBUcmVlID0gKCkgPT4ge1xuICAgIHdoaWxlIChoYW5kbGVOb2RlKCkgJiYgKG5vZGUgPSBub2RlLl8kaG9zdCB8fCBub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5ob3N0KSk7XG4gIH07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcImN1cnJlbnRUYXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gbm9kZSB8fCBkb2N1bWVudDtcbiAgICB9XG4gIH0pO1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmICFzaGFyZWRDb25maWcuZG9uZSkgc2hhcmVkQ29uZmlnLmRvbmUgPSBfJEhZLmRvbmUgPSB0cnVlO1xuICBpZiAoZS5jb21wb3NlZFBhdGgpIHtcbiAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICByZXRhcmdldChwYXRoWzBdKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoIC0gMjsgaSsrKSB7XG4gICAgICBub2RlID0gcGF0aFtpXTtcbiAgICAgIGlmICghaGFuZGxlTm9kZSgpKSBicmVhaztcbiAgICAgIGlmIChub2RlLl8kaG9zdCkge1xuICAgICAgICBub2RlID0gbm9kZS5fJGhvc3Q7XG4gICAgICAgIHdhbGtVcFRyZWUoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBvcmlDdXJyZW50VGFyZ2V0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBlbHNlIHdhbGtVcFRyZWUoKTtcbiAgcmV0YXJnZXQob3JpVGFyZ2V0KTtcbn1cbmZ1bmN0aW9uIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2YWx1ZSwgY3VycmVudCwgbWFya2VyLCB1bndyYXBBcnJheSkge1xuICBjb25zdCBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZyhwYXJlbnQpO1xuICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgIWN1cnJlbnQgJiYgKGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdKTtcbiAgICBsZXQgY2xlYW5lZCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgbm9kZSA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gOCAmJiBub2RlLmRhdGEuc2xpY2UoMCwgMikgPT09IFwiISRcIikgbm9kZS5yZW1vdmUoKTtlbHNlIGNsZWFuZWQucHVzaChub2RlKTtcbiAgICB9XG4gICAgY3VycmVudCA9IGNsZWFuZWQ7XG4gIH1cbiAgd2hpbGUgKHR5cGVvZiBjdXJyZW50ID09PSBcImZ1bmN0aW9uXCIpIGN1cnJlbnQgPSBjdXJyZW50KCk7XG4gIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gIGNvbnN0IHQgPSB0eXBlb2YgdmFsdWUsXG4gICAgbXVsdGkgPSBtYXJrZXIgIT09IHVuZGVmaW5lZDtcbiAgcGFyZW50ID0gbXVsdGkgJiYgY3VycmVudFswXSAmJiBjdXJyZW50WzBdLnBhcmVudE5vZGUgfHwgcGFyZW50O1xuICBpZiAodCA9PT0gXCJzdHJpbmdcIiB8fCB0ID09PSBcIm51bWJlclwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgaWYgKHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChtdWx0aSkge1xuICAgICAgbGV0IG5vZGUgPSBjdXJyZW50WzBdO1xuICAgICAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBub2RlLmRhdGEgIT09IHZhbHVlICYmIChub2RlLmRhdGEgPSB2YWx1ZSk7XG4gICAgICB9IGVsc2Ugbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKTtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGN1cnJlbnQgIT09IFwiXCIgJiYgdHlwZW9mIGN1cnJlbnQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgY3VycmVudCA9IHBhcmVudC5maXJzdENoaWxkLmRhdGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBjdXJyZW50ID0gcGFyZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbHVlID09IG51bGwgfHwgdCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHtcbiAgICAgIGxldCB2ID0gdmFsdWUoKTtcbiAgICAgIHdoaWxlICh0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiKSB2ID0gdigpO1xuICAgICAgY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgY29uc3QgYXJyYXkgPSBbXTtcbiAgICBjb25zdCBjdXJyZW50QXJyYXkgPSBjdXJyZW50ICYmIEFycmF5LmlzQXJyYXkoY3VycmVudCk7XG4gICAgaWYgKG5vcm1hbGl6ZUluY29taW5nQXJyYXkoYXJyYXksIHZhbHVlLCBjdXJyZW50LCB1bndyYXBBcnJheSkpIHtcbiAgICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFycmF5LCBjdXJyZW50LCBtYXJrZXIsIHRydWUpKTtcbiAgICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBpZiAoIWFycmF5Lmxlbmd0aCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXTtcbiAgICAgIGxldCBub2RlID0gYXJyYXlbMF07XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlICE9PSBwYXJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgICAgY29uc3Qgbm9kZXMgPSBbbm9kZV07XG4gICAgICB3aGlsZSAoKG5vZGUgPSBub2RlLm5leHRTaWJsaW5nKSAhPT0gbWFya2VyKSBub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgcmV0dXJuIGN1cnJlbnQgPSBub2RlcztcbiAgICB9XG4gICAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudDtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRBcnJheSkge1xuICAgICAgaWYgKGN1cnJlbnQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlcik7XG4gICAgICB9IGVsc2UgcmVjb25jaWxlQXJyYXlzKHBhcmVudCwgY3VycmVudCwgYXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50ICYmIGNsZWFuQ2hpbGRyZW4ocGFyZW50KTtcbiAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXkpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gYXJyYXk7XG4gIH0gZWxzZSBpZiAodmFsdWUubm9kZVR5cGUpIHtcbiAgICBpZiAoaHlkcmF0aW5nICYmIHZhbHVlLnBhcmVudE5vZGUpIHJldHVybiBjdXJyZW50ID0gbXVsdGkgPyBbdmFsdWVdIDogdmFsdWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY3VycmVudCkpIHtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCB2YWx1ZSk7XG4gICAgICBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbnVsbCwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudCA9PSBudWxsIHx8IGN1cnJlbnQgPT09IFwiXCIgfHwgIXBhcmVudC5maXJzdENoaWxkKSB7XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIH0gZWxzZSBwYXJlbnQucmVwbGFjZUNoaWxkKHZhbHVlLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgY3VycmVudCA9IHZhbHVlO1xuICB9IGVsc2UgY29uc29sZS53YXJuKGBVbnJlY29nbml6ZWQgdmFsdWUuIFNraXBwZWQgaW5zZXJ0aW5nYCwgdmFsdWUpO1xuICByZXR1cm4gY3VycmVudDtcbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgYXJyYXksIGN1cnJlbnQsIHVud3JhcCkge1xuICBsZXQgZHluYW1pYyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBsZXQgaXRlbSA9IGFycmF5W2ldLFxuICAgICAgcHJldiA9IGN1cnJlbnQgJiYgY3VycmVudFtub3JtYWxpemVkLmxlbmd0aF0sXG4gICAgICB0O1xuICAgIGlmIChpdGVtID09IG51bGwgfHwgaXRlbSA9PT0gdHJ1ZSB8fCBpdGVtID09PSBmYWxzZSkgOyBlbHNlIGlmICgodCA9IHR5cGVvZiBpdGVtKSA9PT0gXCJvYmplY3RcIiAmJiBpdGVtLm5vZGVUeXBlKSB7XG4gICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGl0ZW0pKSB7XG4gICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBpdGVtLCBwcmV2KSB8fCBkeW5hbWljO1xuICAgIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAodW53cmFwKSB7XG4gICAgICAgIHdoaWxlICh0eXBlb2YgaXRlbSA9PT0gXCJmdW5jdGlvblwiKSBpdGVtID0gaXRlbSgpO1xuICAgICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBBcnJheS5pc0FycmF5KGl0ZW0pID8gaXRlbSA6IFtpdGVtXSwgQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXYgOiBbcHJldl0pIHx8IGR5bmFtaWM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgICAgIGR5bmFtaWMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IFN0cmluZyhpdGVtKTtcbiAgICAgIGlmIChwcmV2ICYmIHByZXYubm9kZVR5cGUgPT09IDMgJiYgcHJldi5kYXRhID09PSB2YWx1ZSkgbm9ybWFsaXplZC5wdXNoKHByZXYpO2Vsc2Ugbm9ybWFsaXplZC5wdXNoKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBkeW5hbWljO1xufVxuZnVuY3Rpb24gYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyID0gbnVsbCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHBhcmVudC5pbnNlcnRCZWZvcmUoYXJyYXlbaV0sIG1hcmtlcik7XG59XG5mdW5jdGlvbiBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCByZXBsYWNlbWVudCkge1xuICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBwYXJlbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICBjb25zdCBub2RlID0gcmVwbGFjZW1lbnQgfHwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIik7XG4gIGlmIChjdXJyZW50Lmxlbmd0aCkge1xuICAgIGxldCBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSBjdXJyZW50Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBlbCA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZSAhPT0gZWwpIHtcbiAgICAgICAgY29uc3QgaXNQYXJlbnQgPSBlbC5wYXJlbnROb2RlID09PSBwYXJlbnQ7XG4gICAgICAgIGlmICghaW5zZXJ0ZWQgJiYgIWkpIGlzUGFyZW50ID8gcGFyZW50LnJlcGxhY2VDaGlsZChub2RlLCBlbCkgOiBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7ZWxzZSBpc1BhcmVudCAmJiBlbC5yZW1vdmUoKTtcbiAgICAgIH0gZWxzZSBpbnNlcnRlZCA9IHRydWU7XG4gICAgfVxuICB9IGVsc2UgcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO1xuICByZXR1cm4gW25vZGVdO1xufVxuZnVuY3Rpb24gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KSB7XG4gIGNvbnN0IHRlbXBsYXRlcyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChgKltkYXRhLWhrXWApO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXBsYXRlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG5vZGUgPSB0ZW1wbGF0ZXNbaV07XG4gICAgY29uc3Qga2V5ID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJkYXRhLWhrXCIpO1xuICAgIGlmICgoIXJvb3QgfHwga2V5LnN0YXJ0c1dpdGgocm9vdCkpICYmICFzaGFyZWRDb25maWcucmVnaXN0cnkuaGFzKGtleSkpIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5zZXQoa2V5LCBub2RlKTtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0SHlkcmF0aW9uS2V5KCkge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbn1cbmZ1bmN0aW9uIE5vSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dCA/IHVuZGVmaW5lZCA6IHByb3BzLmNoaWxkcmVuO1xufVxuZnVuY3Rpb24gSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbn1cbmNvbnN0IHZvaWRGbiA9ICgpID0+IHVuZGVmaW5lZDtcbmNvbnN0IFJlcXVlc3RDb250ZXh0ID0gU3ltYm9sKCk7XG5mdW5jdGlvbiBpbm5lckhUTUwocGFyZW50LCBjb250ZW50KSB7XG4gICFzaGFyZWRDb25maWcuY29udGV4dCAmJiAocGFyZW50LmlubmVySFRNTCA9IGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0luQnJvd3NlcihmdW5jKSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgJHtmdW5jLm5hbWV9IGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhlIGJyb3dzZXIsIHJldHVybmluZyB1bmRlZmluZWRgKTtcbiAgY29uc29sZS5lcnJvcihlcnIpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmcpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmdBc3luYyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZ0FzeW5jKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyZWFtKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyZWFtKTtcbn1cbmZ1bmN0aW9uIHNzcih0ZW1wbGF0ZSwgLi4ubm9kZXMpIHt9XG5mdW5jdGlvbiBzc3JFbGVtZW50KG5hbWUsIHByb3BzLCBjaGlsZHJlbiwgbmVlZHNJZCkge31cbmZ1bmN0aW9uIHNzckNsYXNzTGlzdCh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzclN0eWxlKHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyQXR0cmlidXRlKGtleSwgdmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JIeWRyYXRpb25LZXkoKSB7fVxuZnVuY3Rpb24gcmVzb2x2ZVNTUk5vZGUobm9kZSkge31cbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7fVxuZnVuY3Rpb24gc3NyU3ByZWFkKHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuKSB7fVxuXG5jb25zdCBpc1NlcnZlciA9IGZhbHNlO1xuY29uc3QgaXNEZXYgPSB0cnVlO1xuY29uc3QgU1ZHX05BTUVTUEFDRSA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjtcbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZSwgaXNTVkcgPSBmYWxzZSkge1xuICByZXR1cm4gaXNTVkcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05BTUVTUEFDRSwgdGFnTmFtZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xufVxuY29uc3QgaHlkcmF0ZSA9ICguLi5hcmdzKSA9PiB7XG4gIGVuYWJsZUh5ZHJhdGlvbigpO1xuICByZXR1cm4gaHlkcmF0ZSQxKC4uLmFyZ3MpO1xufTtcbmZ1bmN0aW9uIFBvcnRhbChwcm9wcykge1xuICBjb25zdCB7XG4gICAgICB1c2VTaGFkb3dcbiAgICB9ID0gcHJvcHMsXG4gICAgbWFya2VyID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIiksXG4gICAgbW91bnQgPSAoKSA9PiBwcm9wcy5tb3VudCB8fCBkb2N1bWVudC5ib2R5LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgbGV0IGNvbnRlbnQ7XG4gIGxldCBoeWRyYXRpbmcgPSAhIXNoYXJlZENvbmZpZy5jb250ZXh0O1xuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChoeWRyYXRpbmcpIGdldE93bmVyKCkudXNlciA9IGh5ZHJhdGluZyA9IGZhbHNlO1xuICAgIGNvbnRlbnQgfHwgKGNvbnRlbnQgPSBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pKSk7XG4gICAgY29uc3QgZWwgPSBtb3VudCgpO1xuICAgIGlmIChlbCBpbnN0YW5jZW9mIEhUTUxIZWFkRWxlbWVudCkge1xuICAgICAgY29uc3QgW2NsZWFuLCBzZXRDbGVhbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHNldENsZWFuKHRydWUpO1xuICAgICAgY3JlYXRlUm9vdChkaXNwb3NlID0+IGluc2VydChlbCwgKCkgPT4gIWNsZWFuKCkgPyBjb250ZW50KCkgOiBkaXNwb3NlKCksIG51bGwpKTtcbiAgICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gY3JlYXRlRWxlbWVudChwcm9wcy5pc1NWRyA/IFwiZ1wiIDogXCJkaXZcIiwgcHJvcHMuaXNTVkcpLFxuICAgICAgICByZW5kZXJSb290ID0gdXNlU2hhZG93ICYmIGNvbnRhaW5lci5hdHRhY2hTaGFkb3cgPyBjb250YWluZXIuYXR0YWNoU2hhZG93KHtcbiAgICAgICAgICBtb2RlOiBcIm9wZW5cIlxuICAgICAgICB9KSA6IGNvbnRhaW5lcjtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250YWluZXIsIFwiXyRob3N0XCIsIHtcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgIHJldHVybiBtYXJrZXIucGFyZW50Tm9kZTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGluc2VydChyZW5kZXJSb290LCBjb250ZW50KTtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgICBwcm9wcy5yZWYgJiYgcHJvcHMucmVmKGNvbnRhaW5lcik7XG4gICAgICBvbkNsZWFudXAoKCkgPT4gZWwucmVtb3ZlQ2hpbGQoY29udGFpbmVyKSk7XG4gICAgfVxuICB9LCB1bmRlZmluZWQsIHtcbiAgICByZW5kZXI6ICFoeWRyYXRpbmdcbiAgfSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5mdW5jdGlvbiBjcmVhdGVEeW5hbWljKGNvbXBvbmVudCwgcHJvcHMpIHtcbiAgY29uc3QgY2FjaGVkID0gY3JlYXRlTWVtbyhjb21wb25lbnQpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gY2FjaGVkKCk7XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihjb21wb25lbnQsIHtcbiAgICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdW50cmFjaygoKSA9PiBjb21wb25lbnQocHJvcHMpKTtcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgY29uc3QgaXNTdmcgPSBTVkdFbGVtZW50cy5oYXMoY29tcG9uZW50KTtcbiAgICAgICAgY29uc3QgZWwgPSBzaGFyZWRDb25maWcuY29udGV4dCA/IGdldE5leHRFbGVtZW50KCkgOiBjcmVhdGVFbGVtZW50KGNvbXBvbmVudCwgaXNTdmcpO1xuICAgICAgICBzcHJlYWQoZWwsIHByb3BzLCBpc1N2Zyk7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gRHluYW1pYyhwcm9wcykge1xuICBjb25zdCBbLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1wiY29tcG9uZW50XCJdKTtcbiAgcmV0dXJuIGNyZWF0ZUR5bmFtaWMoKCkgPT4gcHJvcHMuY29tcG9uZW50LCBvdGhlcnMpO1xufVxuXG5leHBvcnQgeyBBbGlhc2VzLCB2b2lkRm4gYXMgQXNzZXRzLCBDaGlsZFByb3BlcnRpZXMsIERPTUVsZW1lbnRzLCBEZWxlZ2F0ZWRFdmVudHMsIER5bmFtaWMsIEh5ZHJhdGlvbiwgdm9pZEZuIGFzIEh5ZHJhdGlvblNjcmlwdCwgTm9IeWRyYXRpb24sIFBvcnRhbCwgUHJvcGVydGllcywgUmVxdWVzdENvbnRleHQsIFNWR0VsZW1lbnRzLCBTVkdOYW1lc3BhY2UsIGFkZEV2ZW50TGlzdGVuZXIsIGFzc2lnbiwgY2xhc3NMaXN0LCBjbGFzc05hbWUsIGNsZWFyRGVsZWdhdGVkRXZlbnRzLCBjcmVhdGVEeW5hbWljLCBkZWxlZ2F0ZUV2ZW50cywgZHluYW1pY1Byb3BlcnR5LCBlc2NhcGUsIHZvaWRGbiBhcyBnZW5lcmF0ZUh5ZHJhdGlvblNjcmlwdCwgdm9pZEZuIGFzIGdldEFzc2V0cywgZ2V0SHlkcmF0aW9uS2V5LCBnZXROZXh0RWxlbWVudCwgZ2V0TmV4dE1hcmtlciwgZ2V0TmV4dE1hdGNoLCBnZXRQcm9wQWxpYXMsIHZvaWRGbiBhcyBnZXRSZXF1ZXN0RXZlbnQsIGh5ZHJhdGUsIGlubmVySFRNTCwgaW5zZXJ0LCBpc0RldiwgaXNTZXJ2ZXIsIG1lbW8sIHJlbmRlciwgcmVuZGVyVG9TdHJlYW0sIHJlbmRlclRvU3RyaW5nLCByZW5kZXJUb1N0cmluZ0FzeW5jLCByZXNvbHZlU1NSTm9kZSwgcnVuSHlkcmF0aW9uRXZlbnRzLCBzZXRBdHRyaWJ1dGUsIHNldEF0dHJpYnV0ZU5TLCBzZXRCb29sQXR0cmlidXRlLCBzZXRQcm9wZXJ0eSwgc3ByZWFkLCBzc3IsIHNzckF0dHJpYnV0ZSwgc3NyQ2xhc3NMaXN0LCBzc3JFbGVtZW50LCBzc3JIeWRyYXRpb25LZXksIHNzclNwcmVhZCwgc3NyU3R5bGUsIHN0eWxlLCB0ZW1wbGF0ZSwgdXNlLCB2b2lkRm4gYXMgdXNlQXNzZXRzIH07XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCIvLyBHZW5lcmF0ZWQgdXNpbmcgYG5wbSBydW4gYnVpbGRgLiBEbyBub3QgZWRpdC5cblxudmFyIHJlZ2V4ID0gL15bYS16XSg/OltcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKi0oPzpbXFx4MkRcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKiQvO1xuXG52YXIgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRyZXR1cm4gcmVnZXgudGVzdChzdHJpbmcpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lO1xuIiwidmFyIF9fYXN5bmMgPSAoX190aGlzLCBfX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgdmFyIGZ1bGZpbGxlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgcmVqZWN0ZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLnRocm93KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzdGVwID0gKHgpID0+IHguZG9uZSA/IHJlc29sdmUoeC52YWx1ZSkgOiBQcm9taXNlLnJlc29sdmUoeC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTtcbiAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkoX190aGlzLCBfX2FyZ3VtZW50cykpLm5leHQoKSk7XG4gIH0pO1xufTtcblxuLy8gc3JjL2luZGV4LnRzXG5pbXBvcnQgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSBmcm9tIFwiaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWVcIjtcbmZ1bmN0aW9uIGNyZWF0ZUlzb2xhdGVkRWxlbWVudChvcHRpb25zKSB7XG4gIHJldHVybiBfX2FzeW5jKHRoaXMsIG51bGwsIGZ1bmN0aW9uKiAoKSB7XG4gICAgY29uc3QgeyBuYW1lLCBtb2RlID0gXCJjbG9zZWRcIiwgY3NzLCBpc29sYXRlRXZlbnRzID0gZmFsc2UgfSA9IG9wdGlvbnM7XG4gICAgaWYgKCFpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYFwiJHtuYW1lfVwiIGlzIG5vdCBhIHZhbGlkIGN1c3RvbSBlbGVtZW50IG5hbWUuIEl0IG11c3QgYmUgdHdvIHdvcmRzIGFuZCBrZWJhYi1jYXNlLCB3aXRoIGEgZmV3IGV4Y2VwdGlvbnMuIFNlZSBzcGVjIGZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL2N1c3RvbS1lbGVtZW50cy5odG1sI3ZhbGlkLWN1c3RvbS1lbGVtZW50LW5hbWVgXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBwYXJlbnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChuYW1lKTtcbiAgICBjb25zdCBzaGFkb3cgPSBwYXJlbnRFbGVtZW50LmF0dGFjaFNoYWRvdyh7IG1vZGUgfSk7XG4gICAgY29uc3QgaXNvbGF0ZWRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImh0bWxcIik7XG4gICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJib2R5XCIpO1xuICAgIGNvbnN0IGhlYWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaGVhZFwiKTtcbiAgICBpZiAoY3NzKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIGlmIChcInVybFwiIGluIGNzcykge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IHlpZWxkIGZldGNoKGNzcy51cmwpLnRoZW4oKHJlcykgPT4gcmVzLnRleHQoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGNzcy50ZXh0Q29udGVudDtcbiAgICAgIH1cbiAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIH1cbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoaGVhZCk7XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGJvZHkpO1xuICAgIHNoYWRvdy5hcHBlbmRDaGlsZChpc29sYXRlZEVsZW1lbnQpO1xuICAgIGlmIChpc29sYXRlRXZlbnRzKSB7XG4gICAgICBjb25zdCBldmVudFR5cGVzID0gQXJyYXkuaXNBcnJheShpc29sYXRlRXZlbnRzKSA/IGlzb2xhdGVFdmVudHMgOiBbXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJrZXlwcmVzc1wiXTtcbiAgICAgIGV2ZW50VHlwZXMuZm9yRWFjaCgoZXZlbnRUeXBlKSA9PiB7XG4gICAgICAgIGJvZHkuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIChlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcGFyZW50RWxlbWVudCxcbiAgICAgIHNoYWRvdyxcbiAgICAgIGlzb2xhdGVkRWxlbWVudDogYm9keVxuICAgIH07XG4gIH0pO1xufVxuZXhwb3J0IHtcbiAgY3JlYXRlSXNvbGF0ZWRFbGVtZW50XG59O1xuIiwiY29uc3QgbnVsbEtleSA9IFN5bWJvbCgnbnVsbCcpOyAvLyBgb2JqZWN0SGFzaGVzYCBrZXkgZm9yIG51bGxcblxubGV0IGtleUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYW55S2V5c01hcCBleHRlbmRzIE1hcCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9vYmplY3RIYXNoZXMgPSBuZXcgV2Vha01hcCgpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcyA9IG5ldyBNYXAoKTsgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RjMzkvZWNtYTI2Mi9pc3N1ZXMvMTE5NFxuXHRcdHRoaXMuX3B1YmxpY0tleXMgPSBuZXcgTWFwKCk7XG5cblx0XHRjb25zdCBbcGFpcnNdID0gYXJndW1lbnRzOyAvLyBNYXAgY29tcGF0XG5cdFx0aWYgKHBhaXJzID09PSBudWxsIHx8IHBhaXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHBhaXJzW1N5bWJvbC5pdGVyYXRvcl0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IodHlwZW9mIHBhaXJzICsgJyBpcyBub3QgaXRlcmFibGUgKGNhbm5vdCByZWFkIHByb3BlcnR5IFN5bWJvbChTeW1ib2wuaXRlcmF0b3IpKScpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW2tleXMsIHZhbHVlXSBvZiBwYWlycykge1xuXHRcdFx0dGhpcy5zZXQoa2V5cywgdmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdF9nZXRQdWJsaWNLZXlzKGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGtleXMpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUga2V5cyBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBhcnJheScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaXZhdGVLZXkgPSB0aGlzLl9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSk7XG5cblx0XHRsZXQgcHVibGljS2V5O1xuXHRcdGlmIChwcml2YXRlS2V5ICYmIHRoaXMuX3B1YmxpY0tleXMuaGFzKHByaXZhdGVLZXkpKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSB0aGlzLl9wdWJsaWNLZXlzLmdldChwcml2YXRlS2V5KTtcblx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0cHVibGljS2V5ID0gWy4uLmtleXNdOyAvLyBSZWdlbmVyYXRlIGtleXMgYXJyYXkgdG8gYXZvaWQgZXh0ZXJuYWwgaW50ZXJhY3Rpb25cblx0XHRcdHRoaXMuX3B1YmxpY0tleXMuc2V0KHByaXZhdGVLZXksIHB1YmxpY0tleSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtwcml2YXRlS2V5LCBwdWJsaWNLZXl9O1xuXHR9XG5cblx0X2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRjb25zdCBwcml2YXRlS2V5cyA9IFtdO1xuXHRcdGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRpZiAoa2V5ID09PSBudWxsKSB7XG5cdFx0XHRcdGtleSA9IG51bGxLZXk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGhhc2hlcyA9IHR5cGVvZiBrZXkgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBrZXkgPT09ICdmdW5jdGlvbicgPyAnX29iamVjdEhhc2hlcycgOiAodHlwZW9mIGtleSA9PT0gJ3N5bWJvbCcgPyAnX3N5bWJvbEhhc2hlcycgOiBmYWxzZSk7XG5cblx0XHRcdGlmICghaGFzaGVzKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2goa2V5KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpc1toYXNoZXNdLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2godGhpc1toYXNoZXNdLmdldChrZXkpKTtcblx0XHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRcdGNvbnN0IHByaXZhdGVLZXkgPSBgQEBta20tcmVmLSR7a2V5Q291bnRlcisrfUBAYDtcblx0XHRcdFx0dGhpc1toYXNoZXNdLnNldChrZXksIHByaXZhdGVLZXkpO1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHByaXZhdGVLZXkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShwcml2YXRlS2V5cyk7XG5cdH1cblxuXHRzZXQoa2V5cywgdmFsdWUpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cywgdHJ1ZSk7XG5cdFx0cmV0dXJuIHN1cGVyLnNldChwdWJsaWNLZXksIHZhbHVlKTtcblx0fVxuXG5cdGdldChrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5nZXQocHVibGljS2V5KTtcblx0fVxuXG5cdGhhcyhrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5oYXMocHVibGljS2V5KTtcblx0fVxuXG5cdGRlbGV0ZShrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleSwgcHJpdmF0ZUtleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBCb29sZWFuKHB1YmxpY0tleSAmJiBzdXBlci5kZWxldGUocHVibGljS2V5KSAmJiB0aGlzLl9wdWJsaWNLZXlzLmRlbGV0ZShwcml2YXRlS2V5KSk7XG5cdH1cblxuXHRjbGVhcigpIHtcblx0XHRzdXBlci5jbGVhcigpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcy5jbGVhcigpO1xuXHRcdHRoaXMuX3B1YmxpY0tleXMuY2xlYXIoKTtcblx0fVxuXG5cdGdldCBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpIHtcblx0XHRyZXR1cm4gJ01hbnlLZXlzTWFwJztcblx0fVxuXG5cdGdldCBzaXplKCkge1xuXHRcdHJldHVybiBzdXBlci5zaXplO1xuXHR9XG59XG4iLCJmdW5jdGlvbiBpc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgcHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKTtcbiAgaWYgKHByb3RvdHlwZSAhPT0gbnVsbCAmJiBwcm90b3R5cGUgIT09IE9iamVjdC5wcm90b3R5cGUgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvdHlwZSkgIT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLnRvU3RyaW5nVGFnIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09IFwiW29iamVjdCBNb2R1bGVdXCI7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIF9kZWZ1KGJhc2VPYmplY3QsIGRlZmF1bHRzLCBuYW1lc3BhY2UgPSBcIi5cIiwgbWVyZ2VyKSB7XG4gIGlmICghaXNQbGFpbk9iamVjdChkZWZhdWx0cykpIHtcbiAgICByZXR1cm4gX2RlZnUoYmFzZU9iamVjdCwge30sIG5hbWVzcGFjZSwgbWVyZ2VyKTtcbiAgfVxuICBjb25zdCBvYmplY3QgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0cyk7XG4gIGZvciAoY29uc3Qga2V5IGluIGJhc2VPYmplY3QpIHtcbiAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBiYXNlT2JqZWN0W2tleV07XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAobWVyZ2VyICYmIG1lcmdlcihvYmplY3QsIGtleSwgdmFsdWUsIG5hbWVzcGFjZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gWy4uLnZhbHVlLCAuLi5vYmplY3Rba2V5XV07XG4gICAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KHZhbHVlKSAmJiBpc1BsYWluT2JqZWN0KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBfZGVmdShcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIG9iamVjdFtrZXldLFxuICAgICAgICAobmFtZXNwYWNlID8gYCR7bmFtZXNwYWNlfS5gIDogXCJcIikgKyBrZXkudG9TdHJpbmcoKSxcbiAgICAgICAgbWVyZ2VyXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmdShtZXJnZXIpIHtcbiAgcmV0dXJuICguLi5hcmd1bWVudHNfKSA9PiAoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHVuaWNvcm4vbm8tYXJyYXktcmVkdWNlXG4gICAgYXJndW1lbnRzXy5yZWR1Y2UoKHAsIGMpID0+IF9kZWZ1KHAsIGMsIFwiXCIsIG1lcmdlciksIHt9KVxuICApO1xufVxuY29uc3QgZGVmdSA9IGNyZWF0ZURlZnUoKTtcbmNvbnN0IGRlZnVGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKG9iamVjdFtrZXldICE9PSB2b2lkIDAgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcbmNvbnN0IGRlZnVBcnJheUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcblxuZXhwb3J0IHsgY3JlYXRlRGVmdSwgZGVmdSBhcyBkZWZhdWx0LCBkZWZ1LCBkZWZ1QXJyYXlGbiwgZGVmdUZuIH07XG4iLCJjb25zdCBpc0V4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgIT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogZWxlbWVudCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcbmNvbnN0IGlzTm90RXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCA9PT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBudWxsIH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuXG5leHBvcnQgeyBpc0V4aXN0LCBpc05vdEV4aXN0IH07XG4iLCJpbXBvcnQgTWFueUtleXNNYXAgZnJvbSAnbWFueS1rZXlzLW1hcCc7XG5pbXBvcnQgeyBkZWZ1IH0gZnJvbSAnZGVmdSc7XG5pbXBvcnQgeyBpc0V4aXN0IH0gZnJvbSAnLi9kZXRlY3RvcnMubWpzJztcblxuY29uc3QgZ2V0RGVmYXVsdE9wdGlvbnMgPSAoKSA9PiAoe1xuICB0YXJnZXQ6IGdsb2JhbFRoaXMuZG9jdW1lbnQsXG4gIHVuaWZ5UHJvY2VzczogdHJ1ZSxcbiAgZGV0ZWN0b3I6IGlzRXhpc3QsXG4gIG9ic2VydmVDb25maWdzOiB7XG4gICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgIHN1YnRyZWU6IHRydWUsXG4gICAgYXR0cmlidXRlczogdHJ1ZVxuICB9LFxuICBzaWduYWw6IHZvaWQgMCxcbiAgY3VzdG9tTWF0Y2hlcjogdm9pZCAwXG59KTtcbmNvbnN0IG1lcmdlT3B0aW9ucyA9ICh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKSA9PiB7XG4gIHJldHVybiBkZWZ1KHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xufTtcblxuY29uc3QgdW5pZnlDYWNoZSA9IG5ldyBNYW55S2V5c01hcCgpO1xuZnVuY3Rpb24gY3JlYXRlV2FpdEVsZW1lbnQoaW5zdGFuY2VPcHRpb25zKSB7XG4gIGNvbnN0IHsgZGVmYXVsdE9wdGlvbnMgfSA9IGluc3RhbmNlT3B0aW9ucztcbiAgcmV0dXJuIChzZWxlY3Rvciwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgfSA9IG1lcmdlT3B0aW9ucyhvcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgY29uc3QgdW5pZnlQcm9taXNlS2V5ID0gW1xuICAgICAgc2VsZWN0b3IsXG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIF07XG4gICAgY29uc3QgY2FjaGVkUHJvbWlzZSA9IHVuaWZ5Q2FjaGUuZ2V0KHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgaWYgKHVuaWZ5UHJvY2VzcyAmJiBjYWNoZWRQcm9taXNlKSB7XG4gICAgICByZXR1cm4gY2FjaGVkUHJvbWlzZTtcbiAgICB9XG4gICAgY29uc3QgZGV0ZWN0UHJvbWlzZSA9IG5ldyBQcm9taXNlKFxuICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0FzeW5jUHJvbWlzZUV4ZWN1dG9yOiBhdm9pZCBuZXN0aW5nIHByb21pc2VcbiAgICAgIGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihcbiAgICAgICAgICBhc3luYyAobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IF8gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0MiA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0Mi5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZGV0ZWN0UmVzdWx0Mi5yZXN1bHQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICBzaWduYWw/LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgXCJhYm9ydFwiLFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IG9uY2U6IHRydWUgfVxuICAgICAgICApO1xuICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRldGVjdFJlc3VsdC5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoZGV0ZWN0UmVzdWx0LnJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIG9ic2VydmVDb25maWdzKTtcbiAgICAgIH1cbiAgICApLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgdW5pZnlDYWNoZS5kZWxldGUodW5pZnlQcm9taXNlS2V5KTtcbiAgICB9KTtcbiAgICB1bmlmeUNhY2hlLnNldCh1bmlmeVByb21pc2VLZXksIGRldGVjdFByb21pc2UpO1xuICAgIHJldHVybiBkZXRlY3RQcm9taXNlO1xuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0RWxlbWVudCh7XG4gIHRhcmdldCxcbiAgc2VsZWN0b3IsXG4gIGRldGVjdG9yLFxuICBjdXN0b21NYXRjaGVyXG59KSB7XG4gIGNvbnN0IGVsZW1lbnQgPSBjdXN0b21NYXRjaGVyID8gY3VzdG9tTWF0Y2hlcihzZWxlY3RvcikgOiB0YXJnZXQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gIHJldHVybiBhd2FpdCBkZXRlY3RvcihlbGVtZW50KTtcbn1cbmNvbnN0IHdhaXRFbGVtZW50ID0gY3JlYXRlV2FpdEVsZW1lbnQoe1xuICBkZWZhdWx0T3B0aW9uczogZ2V0RGVmYXVsdE9wdGlvbnMoKVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZVdhaXRFbGVtZW50LCBnZXREZWZhdWx0T3B0aW9ucywgd2FpdEVsZW1lbnQgfTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyB3YWl0RWxlbWVudCB9IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudFwiO1xuaW1wb3J0IHtcbiAgaXNFeGlzdCBhcyBtb3VudERldGVjdG9yLFxuICBpc05vdEV4aXN0IGFzIHJlbW92ZURldGVjdG9yXG59IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudC9kZXRlY3RvcnNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi8uLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQb3NpdGlvbihyb290LCBwb3NpdGlvbmVkRWxlbWVudCwgb3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJpbmxpbmVcIikgcmV0dXJuO1xuICBpZiAob3B0aW9ucy56SW5kZXggIT0gbnVsbCkgcm9vdC5zdHlsZS56SW5kZXggPSBTdHJpbmcob3B0aW9ucy56SW5kZXgpO1xuICByb290LnN0eWxlLm92ZXJmbG93ID0gXCJ2aXNpYmxlXCI7XG4gIHJvb3Quc3R5bGUucG9zaXRpb24gPSBcInJlbGF0aXZlXCI7XG4gIHJvb3Quc3R5bGUud2lkdGggPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICBpZiAocG9zaXRpb25lZEVsZW1lbnQpIHtcbiAgICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJvdmVybGF5XCIpIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5zdGFydHNXaXRoKFwiYm90dG9tLVwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5lbmRzV2l0aChcIi1yaWdodFwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEFuY2hvcihvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLmFuY2hvciA9PSBudWxsKSByZXR1cm4gZG9jdW1lbnQuYm9keTtcbiAgbGV0IHJlc29sdmVkID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmICh0eXBlb2YgcmVzb2x2ZWQgPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAocmVzb2x2ZWQuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LmV2YWx1YXRlKFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgZG9jdW1lbnQsXG4gICAgICAgIG51bGwsXG4gICAgICAgIFhQYXRoUmVzdWx0LkZJUlNUX09SREVSRURfTk9ERV9UWVBFLFxuICAgICAgICBudWxsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zaW5nbGVOb2RlVmFsdWUgPz8gdm9pZCAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihyZXNvbHZlZCkgPz8gdm9pZCAwO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzb2x2ZWQgPz8gdm9pZCAwO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1vdW50VWkocm9vdCwgb3B0aW9ucykge1xuICBjb25zdCBhbmNob3IgPSBnZXRBbmNob3Iob3B0aW9ucyk7XG4gIGlmIChhbmNob3IgPT0gbnVsbClcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiRmFpbGVkIHRvIG1vdW50IGNvbnRlbnQgc2NyaXB0IFVJOiBjb3VsZCBub3QgZmluZCBhbmNob3IgZWxlbWVudFwiXG4gICAgKTtcbiAgc3dpdGNoIChvcHRpb25zLmFwcGVuZCkge1xuICAgIGNhc2Ugdm9pZCAwOlxuICAgIGNhc2UgXCJsYXN0XCI6XG4gICAgICBhbmNob3IuYXBwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImZpcnN0XCI6XG4gICAgICBhbmNob3IucHJlcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJyZXBsYWNlXCI6XG4gICAgICBhbmNob3IucmVwbGFjZVdpdGgocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYmVmb3JlXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgb3B0aW9ucy5hcHBlbmQoYW5jaG9yLCByb290KTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW91bnRGdW5jdGlvbnMoYmFzZUZ1bmN0aW9ucywgb3B0aW9ucykge1xuICBsZXQgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIGNvbnN0IHN0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYXV0b01vdW50SW5zdGFuY2U/LnN0b3BBdXRvTW91bnQoKTtcbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgYmFzZUZ1bmN0aW9ucy5tb3VudCgpO1xuICB9O1xuICBjb25zdCB1bm1vdW50ID0gYmFzZUZ1bmN0aW9ucy5yZW1vdmU7XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBzdG9wQXV0b01vdW50KCk7XG4gICAgYmFzZUZ1bmN0aW9ucy5yZW1vdmUoKTtcbiAgfTtcbiAgY29uc3QgYXV0b01vdW50ID0gKGF1dG9Nb3VudE9wdGlvbnMpID0+IHtcbiAgICBpZiAoYXV0b01vdW50SW5zdGFuY2UpIHtcbiAgICAgIGxvZ2dlci53YXJuKFwiYXV0b01vdW50IGlzIGFscmVhZHkgc2V0LlwiKTtcbiAgICB9XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSBhdXRvTW91bnRVaShcbiAgICAgIHsgbW91bnQsIHVubW91bnQsIHN0b3BBdXRvTW91bnQgfSxcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgLi4uYXV0b01vdW50T3B0aW9uc1xuICAgICAgfVxuICAgICk7XG4gIH07XG4gIHJldHVybiB7XG4gICAgbW91bnQsXG4gICAgcmVtb3ZlLFxuICAgIGF1dG9Nb3VudFxuICB9O1xufVxuZnVuY3Rpb24gYXV0b01vdW50VWkodWlDYWxsYmFja3MsIG9wdGlvbnMpIHtcbiAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCBFWFBMSUNJVF9TVE9QX1JFQVNPTiA9IFwiZXhwbGljaXRfc3RvcF9hdXRvX21vdW50XCI7XG4gIGNvbnN0IF9zdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGFib3J0Q29udHJvbGxlci5hYm9ydChFWFBMSUNJVF9TVE9QX1JFQVNPTik7XG4gICAgb3B0aW9ucy5vblN0b3A/LigpO1xuICB9O1xuICBsZXQgcmVzb2x2ZWRBbmNob3IgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHJlc29sdmVkQW5jaG9yIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJhdXRvTW91bnQgYW5kIEVsZW1lbnQgYW5jaG9yIG9wdGlvbiBjYW5ub3QgYmUgY29tYmluZWQuIEF2b2lkIHBhc3NpbmcgYEVsZW1lbnRgIGRpcmVjdGx5IG9yIGAoKSA9PiBFbGVtZW50YCB0byB0aGUgYW5jaG9yLlwiXG4gICAgKTtcbiAgfVxuICBhc3luYyBmdW5jdGlvbiBvYnNlcnZlRWxlbWVudChzZWxlY3Rvcikge1xuICAgIGxldCBpc0FuY2hvckV4aXN0ID0gISFnZXRBbmNob3Iob3B0aW9ucyk7XG4gICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgfVxuICAgIHdoaWxlICghYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjaGFuZ2VkQW5jaG9yID0gYXdhaXQgd2FpdEVsZW1lbnQoc2VsZWN0b3IgPz8gXCJib2R5XCIsIHtcbiAgICAgICAgICBjdXN0b21NYXRjaGVyOiAoKSA9PiBnZXRBbmNob3Iob3B0aW9ucykgPz8gbnVsbCxcbiAgICAgICAgICBkZXRlY3RvcjogaXNBbmNob3JFeGlzdCA/IHJlbW92ZURldGVjdG9yIDogbW91bnREZXRlY3RvcixcbiAgICAgICAgICBzaWduYWw6IGFib3J0Q29udHJvbGxlci5zaWduYWxcbiAgICAgICAgfSk7XG4gICAgICAgIGlzQW5jaG9yRXhpc3QgPSAhIWNoYW5nZWRBbmNob3I7XG4gICAgICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy51bm1vdW50KCk7XG4gICAgICAgICAgaWYgKG9wdGlvbnMub25jZSkge1xuICAgICAgICAgICAgdWlDYWxsYmFja3Muc3RvcEF1dG9Nb3VudCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCAmJiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlYXNvbiA9PT0gRVhQTElDSVRfU1RPUF9SRUFTT04pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBvYnNlcnZlRWxlbWVudChyZXNvbHZlZEFuY2hvcik7XG4gIHJldHVybiB7IHN0b3BBdXRvTW91bnQ6IF9zdG9wQXV0b01vdW50IH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gc3BsaXRTaGFkb3dSb290Q3NzKGNzcykge1xuICBsZXQgc2hhZG93Q3NzID0gY3NzO1xuICBsZXQgZG9jdW1lbnRDc3MgPSBcIlwiO1xuICBjb25zdCBydWxlc1JlZ2V4ID0gLyhcXHMqQChwcm9wZXJ0eXxmb250LWZhY2UpW1xcc1xcU10qP3tbXFxzXFxTXSo/fSkvZ207XG4gIGxldCBtYXRjaDtcbiAgd2hpbGUgKChtYXRjaCA9IHJ1bGVzUmVnZXguZXhlYyhjc3MpKSAhPT0gbnVsbCkge1xuICAgIGRvY3VtZW50Q3NzICs9IG1hdGNoWzFdO1xuICAgIHNoYWRvd0NzcyA9IHNoYWRvd0Nzcy5yZXBsYWNlKG1hdGNoWzFdLCBcIlwiKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGRvY3VtZW50Q3NzOiBkb2N1bWVudENzcy50cmltKCksXG4gICAgc2hhZG93Q3NzOiBzaGFkb3dDc3MudHJpbSgpXG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBjcmVhdGVJc29sYXRlZEVsZW1lbnQgfSBmcm9tIFwiQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnRcIjtcbmltcG9ydCB7IGFwcGx5UG9zaXRpb24sIGNyZWF0ZU1vdW50RnVuY3Rpb25zLCBtb3VudFVpIH0gZnJvbSBcIi4vc2hhcmVkLm1qc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7IHNwbGl0U2hhZG93Um9vdENzcyB9IGZyb20gXCIuLi9zcGxpdC1zaGFkb3ctcm9vdC1jc3MubWpzXCI7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwgb3B0aW9ucykge1xuICBjb25zdCBpbnN0YW5jZUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDE1KTtcbiAgY29uc3QgY3NzID0gW107XG4gIGlmICghb3B0aW9ucy5pbmhlcml0U3R5bGVzKSB7XG4gICAgY3NzLnB1c2goYC8qIFdYVCBTaGFkb3cgUm9vdCBSZXNldCAqLyA6aG9zdHthbGw6aW5pdGlhbCAhaW1wb3J0YW50O31gKTtcbiAgfVxuICBpZiAob3B0aW9ucy5jc3MpIHtcbiAgICBjc3MucHVzaChvcHRpb25zLmNzcyk7XG4gIH1cbiAgaWYgKGN0eC5vcHRpb25zPy5jc3NJbmplY3Rpb25Nb2RlID09PSBcInVpXCIpIHtcbiAgICBjb25zdCBlbnRyeUNzcyA9IGF3YWl0IGxvYWRDc3MoKTtcbiAgICBjc3MucHVzaChlbnRyeUNzcy5yZXBsYWNlQWxsKFwiOnJvb3RcIiwgXCI6aG9zdFwiKSk7XG4gIH1cbiAgY29uc3QgeyBzaGFkb3dDc3MsIGRvY3VtZW50Q3NzIH0gPSBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzLmpvaW4oXCJcXG5cIikudHJpbSgpKTtcbiAgY29uc3Qge1xuICAgIGlzb2xhdGVkRWxlbWVudDogdWlDb250YWluZXIsXG4gICAgcGFyZW50RWxlbWVudDogc2hhZG93SG9zdCxcbiAgICBzaGFkb3dcbiAgfSA9IGF3YWl0IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCh7XG4gICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgIGNzczoge1xuICAgICAgdGV4dENvbnRlbnQ6IHNoYWRvd0Nzc1xuICAgIH0sXG4gICAgbW9kZTogb3B0aW9ucy5tb2RlID8/IFwib3BlblwiLFxuICAgIGlzb2xhdGVFdmVudHM6IG9wdGlvbnMuaXNvbGF0ZUV2ZW50c1xuICB9KTtcbiAgc2hhZG93SG9zdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXd4dC1zaGFkb3ctcm9vdFwiLCBcIlwiKTtcbiAgbGV0IG1vdW50ZWQ7XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIG1vdW50VWkoc2hhZG93SG9zdCwgb3B0aW9ucyk7XG4gICAgYXBwbHlQb3NpdGlvbihzaGFkb3dIb3N0LCBzaGFkb3cucXVlcnlTZWxlY3RvcihcImh0bWxcIiksIG9wdGlvbnMpO1xuICAgIGlmIChkb2N1bWVudENzcyAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gZG9jdW1lbnRDc3M7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoXCJ3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzXCIsIGluc3RhbmNlSWQpO1xuICAgICAgKGRvY3VtZW50LmhlYWQgPz8gZG9jdW1lbnQuYm9keSkuYXBwZW5kKHN0eWxlKTtcbiAgICB9XG4gICAgbW91bnRlZCA9IG9wdGlvbnMub25Nb3VudCh1aUNvbnRhaW5lciwgc2hhZG93LCBzaGFkb3dIb3N0KTtcbiAgfTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIG9wdGlvbnMub25SZW1vdmU/Lihtb3VudGVkKTtcbiAgICBzaGFkb3dIb3N0LnJlbW92ZSgpO1xuICAgIGNvbnN0IGRvY3VtZW50U3R5bGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICk7XG4gICAgZG9jdW1lbnRTdHlsZT8ucmVtb3ZlKCk7XG4gICAgd2hpbGUgKHVpQ29udGFpbmVyLmxhc3RDaGlsZClcbiAgICAgIHVpQ29udGFpbmVyLnJlbW92ZUNoaWxkKHVpQ29udGFpbmVyLmxhc3RDaGlsZCk7XG4gICAgbW91bnRlZCA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnRGdW5jdGlvbnMgPSBjcmVhdGVNb3VudEZ1bmN0aW9ucyhcbiAgICB7XG4gICAgICBtb3VudCxcbiAgICAgIHJlbW92ZVxuICAgIH0sXG4gICAgb3B0aW9uc1xuICApO1xuICBjdHgub25JbnZhbGlkYXRlZChyZW1vdmUpO1xuICByZXR1cm4ge1xuICAgIHNoYWRvdyxcbiAgICBzaGFkb3dIb3N0LFxuICAgIHVpQ29udGFpbmVyLFxuICAgIC4uLm1vdW50RnVuY3Rpb25zLFxuICAgIGdldCBtb3VudGVkKCkge1xuICAgICAgcmV0dXJuIG1vdW50ZWQ7XG4gICAgfVxuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gbG9hZENzcygpIHtcbiAgY29uc3QgdXJsID0gYnJvd3Nlci5ydW50aW1lLmdldFVSTChgL2NvbnRlbnQtc2NyaXB0cy8ke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfS5jc3NgKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwpO1xuICAgIHJldHVybiBhd2FpdCByZXMudGV4dCgpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBGYWlsZWQgdG8gbG9hZCBzdHlsZXMgQCAke3VybH0uIERpZCB5b3UgZm9yZ2V0IHRvIGltcG9ydCB0aGUgc3R5bGVzaGVldCBpbiB5b3VyIGVudHJ5cG9pbnQ/YCxcbiAgICAgIGVyclxuICAgICk7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCJmdW5jdGlvbiByKGUpe3ZhciB0LGYsbj1cIlwiO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlfHxcIm51bWJlclwiPT10eXBlb2YgZSluKz1lO2Vsc2UgaWYoXCJvYmplY3RcIj09dHlwZW9mIGUpaWYoQXJyYXkuaXNBcnJheShlKSl7dmFyIG89ZS5sZW5ndGg7Zm9yKHQ9MDt0PG87dCsrKWVbdF0mJihmPXIoZVt0XSkpJiYobiYmKG4rPVwiIFwiKSxuKz1mKX1lbHNlIGZvcihmIGluIGUpZVtmXSYmKG4mJihuKz1cIiBcIiksbis9Zik7cmV0dXJuIG59ZXhwb3J0IGZ1bmN0aW9uIGNsc3goKXtmb3IodmFyIGUsdCxmPTAsbj1cIlwiLG89YXJndW1lbnRzLmxlbmd0aDtmPG87ZisrKShlPWFyZ3VtZW50c1tmXSkmJih0PXIoZSkpJiYobiYmKG4rPVwiIFwiKSxuKz10KTtyZXR1cm4gbn1leHBvcnQgZGVmYXVsdCBjbHN4OyIsImltcG9ydCB7IGNsc3gsIHR5cGUgQ2xhc3NWYWx1ZSB9IGZyb20gJ2Nsc3gnXG5cbmV4cG9ydCBmdW5jdGlvbiBjbiguLi5pbnB1dHM6IENsYXNzVmFsdWVbXSkge1xuICByZXR1cm4gY2xzeChpbnB1dHMpXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGxvZ28/OiBKU1guRWxlbWVudDtcbiAgYWN0aW9ucz86IEpTWC5FbGVtZW50O1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ21pbmltYWwnIHwgJ3RyYW5zcGFyZW50JztcbiAgc3RpY2t5PzogYm9vbGVhbjtcbiAgc2hvd01lbnVCdXR0b24/OiBib29sZWFuO1xuICBvbk1lbnVDbGljaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgSGVhZGVyOiBDb21wb25lbnQ8SGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtpc1Njcm9sbGVkLCBzZXRJc1Njcm9sbGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgLy8gVHJhY2sgc2Nyb2xsIHBvc2l0aW9uIGZvciBzdGlja3kgaGVhZGVyIGVmZmVjdHNcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHByb3BzLnN0aWNreSkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCAoKSA9PiB7XG4gICAgICBzZXRJc1Njcm9sbGVkKHdpbmRvdy5zY3JvbGxZID4gMTApO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IHByb3BzLnZhcmlhbnQgfHwgJ2RlZmF1bHQnO1xuXG4gIHJldHVybiAoXG4gICAgPGhlYWRlclxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAndy1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGUnOiB2YXJpYW50KCkgPT09ICdkZWZhdWx0JyxcbiAgICAgICAgICAnYmctdHJhbnNwYXJlbnQnOiB2YXJpYW50KCkgPT09ICdtaW5pbWFsJyB8fCB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2JhY2tkcm9wLWJsdXItbWQgYmctc3VyZmFjZS84MCc6IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgICAgLy8gU3RpY2t5IGJlaGF2aW9yXG4gICAgICAgICAgJ3N0aWNreSB0b3AtMCB6LTUwJzogcHJvcHMuc3RpY2t5LFxuICAgICAgICAgICdzaGFkb3ctbGcnOiBwcm9wcy5zdGlja3kgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICB9LFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctc2NyZWVuLXhsIG14LWF1dG8gcHgtNCBzbTpweC02IGxnOnB4LThcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE2XCI+XG4gICAgICAgICAgey8qIExlZnQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnNob3dNZW51QnV0dG9ufT5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uTWVudUNsaWNrfVxuICAgICAgICAgICAgICAgIGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgaG92ZXI6YmctaGlnaGxpZ2h0IHRyYW5zaXRpb24tY29sb3JzIGxnOmhpZGRlblwiXG4gICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1lbnVcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHN2ZyBjbGFzcz1cInctNiBoLTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIj5cbiAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIHN0cm9rZS13aWR0aD1cIjJcIiBkPVwiTTQgNmgxNk00IDEyaDE2TTQgMThoMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMubG9nb30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC14bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5XCI+e3Byb3BzLnRpdGxlfTwvaDE+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgIHtwcm9wcy5sb2dvfVxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgey8qIFJpZ2h0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuYWN0aW9uc30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmFjdGlvbnN9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9oZWFkZXI+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB0eXBlIHsgSlNYIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1dHRvblByb3BzIGV4dGVuZHMgSlNYLkJ1dHRvbkhUTUxBdHRyaWJ1dGVzPEhUTUxCdXR0b25FbGVtZW50PiB7XG4gIHZhcmlhbnQ/OiAncHJpbWFyeScgfCAnc2Vjb25kYXJ5JyB8ICdnaG9zdCcgfCAnZGFuZ2VyJ1xuICBzaXplPzogJ3NtJyB8ICdtZCcgfCAnbGcnXG4gIGZ1bGxXaWR0aD86IGJvb2xlYW5cbiAgbG9hZGluZz86IGJvb2xlYW5cbiAgbGVmdEljb24/OiBKU1guRWxlbWVudFxuICByaWdodEljb24/OiBKU1guRWxlbWVudFxufVxuXG5leHBvcnQgY29uc3QgQnV0dG9uID0gKHByb3BzOiBCdXR0b25Qcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXG4gICAgJ3ZhcmlhbnQnLFxuICAgICdzaXplJyxcbiAgICAnZnVsbFdpZHRoJyxcbiAgICAnbG9hZGluZycsXG4gICAgJ2xlZnRJY29uJyxcbiAgICAncmlnaHRJY29uJyxcbiAgICAnY2hpbGRyZW4nLFxuICAgICdjbGFzcycsXG4gICAgJ2Rpc2FibGVkJyxcbiAgXSlcblxuICBjb25zdCB2YXJpYW50ID0gKCkgPT4gbG9jYWwudmFyaWFudCB8fCAncHJpbWFyeSdcbiAgY29uc3Qgc2l6ZSA9ICgpID0+IGxvY2FsLnNpemUgfHwgJ21kJ1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgZGlzYWJsZWQ9e2xvY2FsLmRpc2FibGVkIHx8IGxvY2FsLmxvYWRpbmd9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1hbGwgY3Vyc29yLXBvaW50ZXIgb3V0bGluZS1ub25lIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFZhcmlhbnRzXG4gICAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBob3ZlcjpzaGFkb3ctbGcgaG92ZXI6c2NhbGUtMTA1IGdsb3ctcHJpbWFyeSc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdwcmltYXJ5JyxcbiAgICAgICAgICAnYmctc3VyZmFjZSB0ZXh0LXByaW1hcnkgYm9yZGVyIGJvcmRlci1kZWZhdWx0IGhvdmVyOmJnLWVsZXZhdGVkIGhvdmVyOmJvcmRlci1zdHJvbmcnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnc2Vjb25kYXJ5JyxcbiAgICAgICAgICAndGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IGhvdmVyOmJnLXN1cmZhY2UnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnZ2hvc3QnLFxuICAgICAgICAgICdiZy1yZWQtNjAwIHRleHQtd2hpdGUgaG92ZXI6YmctcmVkLTcwMCBob3ZlcjpzaGFkb3ctbGcnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnZGFuZ2VyJyxcbiAgICAgICAgICAvLyBTaXplc1xuICAgICAgICAgICdoLTggcHgtMyB0ZXh0LXNtIHJvdW5kZWQtbWQgZ2FwLTEuNSc6IHNpemUoKSA9PT0gJ3NtJyxcbiAgICAgICAgICAnaC0xMCBweC00IHRleHQtYmFzZSByb3VuZGVkLWxnIGdhcC0yJzogc2l6ZSgpID09PSAnbWQnLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyByb3VuZGVkLWxnIGdhcC0yLjUnOiBzaXplKCkgPT09ICdsZycsXG4gICAgICAgICAgLy8gRnVsbCB3aWR0aFxuICAgICAgICAgICd3LWZ1bGwnOiBsb2NhbC5mdWxsV2lkdGgsXG4gICAgICAgICAgLy8gTG9hZGluZyBzdGF0ZVxuICAgICAgICAgICdjdXJzb3Itd2FpdCc6IGxvY2FsLmxvYWRpbmcsXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2FsLmNsYXNzXG4gICAgICApfVxuICAgICAgey4uLm90aGVyc31cbiAgICA+XG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5sb2FkaW5nfT5cbiAgICAgICAgPHN2Z1xuICAgICAgICAgIGNsYXNzPVwiYW5pbWF0ZS1zcGluIGgtNCB3LTRcIlxuICAgICAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgICAgPlxuICAgICAgICAgIDxjaXJjbGVcbiAgICAgICAgICAgIGNsYXNzPVwib3BhY2l0eS0yNVwiXG4gICAgICAgICAgICBjeD1cIjEyXCJcbiAgICAgICAgICAgIGN5PVwiMTJcIlxuICAgICAgICAgICAgcj1cIjEwXCJcbiAgICAgICAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICAgICAgICBzdHJva2Utd2lkdGg9XCI0XCJcbiAgICAgICAgICAvPlxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBjbGFzcz1cIm9wYWNpdHktNzVcIlxuICAgICAgICAgICAgZmlsbD1cImN1cnJlbnRDb2xvclwiXG4gICAgICAgICAgICBkPVwiTTQgMTJhOCA4IDAgMDE4LThWMEM1LjM3MyAwIDAgNS4zNzMgMCAxMmg0em0yIDUuMjkxQTcuOTYyIDcuOTYyIDAgMDE0IDEySDBjMCAzLjA0MiAxLjEzNSA1LjgyNCAzIDcuOTM4bDMtMi42NDd6XCJcbiAgICAgICAgICAvPlxuICAgICAgICA8L3N2Zz5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwubGVmdEljb24gJiYgIWxvY2FsLmxvYWRpbmd9PlxuICAgICAgICB7bG9jYWwubGVmdEljb259XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmNoaWxkcmVufT5cbiAgICAgICAgPHNwYW4+e2xvY2FsLmNoaWxkcmVufTwvc3Bhbj5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwucmlnaHRJY29ufT5cbiAgICAgICAge2xvY2FsLnJpZ2h0SWNvbn1cbiAgICAgIDwvU2hvdz5cbiAgICA8L2J1dHRvbj5cbiAgKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcblxuZXhwb3J0IHR5cGUgT25ib2FyZGluZ1N0ZXAgPSAnY29ubmVjdC13YWxsZXQnIHwgJ2dlbmVyYXRpbmctdG9rZW4nIHwgJ2NvbXBsZXRlJztcblxuZXhwb3J0IGludGVyZmFjZSBPbmJvYXJkaW5nRmxvd1Byb3BzIHtcbiAgc3RlcDogT25ib2FyZGluZ1N0ZXA7XG4gIGVycm9yPzogc3RyaW5nIHwgbnVsbDtcbiAgd2FsbGV0QWRkcmVzcz86IHN0cmluZyB8IG51bGw7XG4gIHRva2VuPzogc3RyaW5nIHwgbnVsbDtcbiAgb25Db25uZWN0V2FsbGV0OiAoKSA9PiB2b2lkO1xuICBvblVzZVRlc3RNb2RlOiAoKSA9PiB2b2lkO1xuICBvblVzZVByaXZhdGVLZXk6IChwcml2YXRlS2V5OiBzdHJpbmcpID0+IHZvaWQ7XG4gIG9uQ29tcGxldGU6ICgpID0+IHZvaWQ7XG4gIGlzQ29ubmVjdGluZz86IGJvb2xlYW47XG4gIGlzR2VuZXJhdGluZz86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgT25ib2FyZGluZ0Zsb3c6IENvbXBvbmVudDxPbmJvYXJkaW5nRmxvd1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd1Rlc3RPcHRpb24sIHNldFNob3dUZXN0T3B0aW9uXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzaG93UHJpdmF0ZUtleUlucHV0LCBzZXRTaG93UHJpdmF0ZUtleUlucHV0XSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtwcml2YXRlS2V5LCBzZXRQcml2YXRlS2V5XSA9IGNyZWF0ZVNpZ25hbCgnJyk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICdtaW4taC1zY3JlZW4gYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1ncmF5LTkwMCB0by1ibGFjayBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlcicsXG4gICAgICBwcm9wcy5jbGFzc1xuICAgICl9PlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LTJ4bCB3LWZ1bGwgcC0xMlwiPlxuICAgICAgICB7LyogTG9nby9IZWFkZXIgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBtYi0xMlwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OpDwvZGl2PlxuICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQtNnhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgIFNjYXJsZXR0IEthcmFva2VcbiAgICAgICAgICA8L2gxPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LWdyYXktNDAwXCI+XG4gICAgICAgICAgICBBSS1wb3dlcmVkIGthcmFva2UgZm9yIFNvdW5kQ2xvdWRcbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBQcm9ncmVzcyBEb3RzICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBqdXN0aWZ5LWNlbnRlciBtYi0xMlwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0zXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdjb25uZWN0LXdhbGxldCcgXG4gICAgICAgICAgICAgICAgPyAnYmctcHVycGxlLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6IHByb3BzLndhbGxldEFkZHJlc3MgXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnZ2VuZXJhdGluZy10b2tlbicgXG4gICAgICAgICAgICAgICAgPyAnYmctcHVycGxlLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6IHByb3BzLnRva2VuIFxuICAgICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogRXJyb3IgRGlzcGxheSAqL31cbiAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuZXJyb3J9PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYi04IHAtNiBiZy1yZWQtOTAwLzIwIGJvcmRlciBib3JkZXItcmVkLTgwMCByb3VuZGVkLXhsXCI+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtcmVkLTQwMCB0ZXh0LWNlbnRlciB0ZXh0LWxnXCI+e3Byb3BzLmVycm9yfTwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9TaG93PlxuXG4gICAgICAgIHsvKiBDb250ZW50ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgey8qIENvbm5lY3QgV2FsbGV0IFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0J30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIENvbm5lY3QgWW91ciBXYWxsZXRcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICAgIENvbm5lY3QgeW91ciB3YWxsZXQgdG8gZ2V0IHN0YXJ0ZWRcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTQgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc0Nvbm5lY3Rpbmd9XG4gICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNiB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7cHJvcHMuaXNDb25uZWN0aW5nID8gKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ3LTQgaC00IGJvcmRlci0yIGJvcmRlci1jdXJyZW50IGJvcmRlci1yLXRyYW5zcGFyZW50IHJvdW5kZWQtZnVsbCBhbmltYXRlLXNwaW5cIiAvPlxuICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3RpbmcuLi5cbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPvCfpoo8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdCB3aXRoIE1ldGFNYXNrXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshc2hvd1Rlc3RPcHRpb24oKSAmJiAhc2hvd1ByaXZhdGVLZXlJbnB1dCgpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC00IGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93VGVzdE9wdGlvbih0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBVc2UgZGVtbyBtb2RlXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRleHQtZ3JheS02MDBcIj58PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1ByaXZhdGVLZXlJbnB1dCh0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBVc2UgcHJpdmF0ZSBrZXlcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93VGVzdE9wdGlvbigpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwdC02IHNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktODAwIHB0LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblVzZVRlc3RNb2RlfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cInNlY29uZGFyeVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNFwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQ29udGludWUgd2l0aCBEZW1vIE1vZGVcbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93VGVzdE9wdGlvbihmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9ycyBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBCYWNrXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByaXZhdGVLZXlJbnB1dCgpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwdC02IHNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktODAwIHB0LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cHJpdmF0ZUtleSgpfVxuICAgICAgICAgICAgICAgICAgICAgICAgb25JbnB1dD17KGUpID0+IHNldFByaXZhdGVLZXkoZS5jdXJyZW50VGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRW50ZXIgcHJpdmF0ZSBrZXlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNCBweC00IGJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZyB0ZXh0LXdoaXRlIHBsYWNlaG9sZGVyLWdyYXktNTAwIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItcHVycGxlLTUwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBwcm9wcy5vblVzZVByaXZhdGVLZXkocHJpdmF0ZUtleSgpKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXshcHJpdmF0ZUtleSgpIHx8IHByaXZhdGVLZXkoKS5sZW5ndGggIT09IDY0fVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cInNlY29uZGFyeVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNCBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggUHJpdmF0ZSBLZXlcbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dQcml2YXRlS2V5SW5wdXQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRQcml2YXRlS2V5KCcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9ycyBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBCYWNrXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIEdlbmVyYXRpbmcgVG9rZW4gU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnZ2VuZXJhdGluZy10b2tlbid9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBTZXR0aW5nIFVwIFlvdXIgQWNjb3VudFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMud2FsbGV0QWRkcmVzc30+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC1sZyBtYi0zXCI+XG4gICAgICAgICAgICAgICAgICAgIENvbm5lY3RlZCB3YWxsZXQ6XG4gICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8Y29kZSBjbGFzcz1cInRleHQtbGcgdGV4dC1wdXJwbGUtNDAwIGJnLWdyYXktODAwIHB4LTQgcHktMiByb3VuZGVkLWxnIGZvbnQtbW9ubyBpbmxpbmUtYmxvY2tcIj5cbiAgICAgICAgICAgICAgICAgICAge3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKDAsIDYpfS4uLntwcm9wcy53YWxsZXRBZGRyZXNzPy5zbGljZSgtNCl9XG4gICAgICAgICAgICAgICAgICA8L2NvZGU+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHktMTJcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidy0yMCBoLTIwIGJvcmRlci00IGJvcmRlci1wdXJwbGUtNTAwIGJvcmRlci10LXRyYW5zcGFyZW50IHJvdW5kZWQtZnVsbCBhbmltYXRlLXNwaW4gbXgtYXV0b1wiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhsXCI+XG4gICAgICAgICAgICAgICAge3Byb3BzLmlzR2VuZXJhdGluZyBcbiAgICAgICAgICAgICAgICAgID8gJ0dlbmVyYXRpbmcgeW91ciBhY2Nlc3MgdG9rZW4uLi4nIFxuICAgICAgICAgICAgICAgICAgOiAnVmVyaWZ5aW5nIHlvdXIgYWNjb3VudC4uLid9XG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgIHsvKiBDb21wbGV0ZSBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdjb21wbGV0ZSd9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgbWItNlwiPvCfjok8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFlvdSdyZSBBbGwgU2V0IVxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGwgbWF4LXctbWQgbXgtYXV0byBtYi04XCI+XG4gICAgICAgICAgICAgICAgICBZb3VyIGFjY291bnQgaXMgcmVhZHkuIFRpbWUgdG8gc2luZyFcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db21wbGV0ZX1cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIFN0YXJ0IFNpbmdpbmchIPCfmoBcbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIG10LTZcIj5cbiAgICAgICAgICAgICAgICBMb29rIGZvciB0aGUga2FyYW9rZSB3aWRnZXQgb24gYW55IFNvdW5kQ2xvdWQgdHJhY2tcbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBGb3IsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljc0Rpc3BsYXlQcm9wcyB7XG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyO1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEx5cmljc0Rpc3BsYXk6IENvbXBvbmVudDxMeXJpY3NEaXNwbGF5UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50TGluZUluZGV4LCBzZXRDdXJyZW50TGluZUluZGV4XSA9IGNyZWF0ZVNpZ25hbCgtMSk7XG4gIGxldCBjb250YWluZXJSZWY6IEhUTUxEaXZFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG4gIC8vIEZpbmQgY3VycmVudCBsaW5lIGJhc2VkIG9uIHRpbWVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXByb3BzLmN1cnJlbnRUaW1lKSB7XG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KC0xKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0aW1lID0gcHJvcHMuY3VycmVudFRpbWU7XG4gICAgY29uc3QgaW5kZXggPSBwcm9wcy5seXJpY3MuZmluZEluZGV4KChsaW5lKSA9PiB7XG4gICAgICBjb25zdCBlbmRUaW1lID0gbGluZS5zdGFydFRpbWUgKyBsaW5lLmR1cmF0aW9uO1xuICAgICAgcmV0dXJuIHRpbWUgPj0gbGluZS5zdGFydFRpbWUgJiYgdGltZSA8IGVuZFRpbWU7XG4gICAgfSk7XG5cbiAgICBzZXRDdXJyZW50TGluZUluZGV4KGluZGV4KTtcbiAgfSk7XG5cbiAgLy8gQXV0by1zY3JvbGwgdG8gY3VycmVudCBsaW5lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgaWYgKGluZGV4ID09PSAtMSB8fCAhY29udGFpbmVyUmVmIHx8ICFwcm9wcy5pc1BsYXlpbmcpIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmVFbGVtZW50cyA9IGNvbnRhaW5lclJlZi5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saW5lLWluZGV4XScpO1xuICAgIGNvbnN0IGN1cnJlbnRFbGVtZW50ID0gbGluZUVsZW1lbnRzW2luZGV4XSBhcyBIVE1MRWxlbWVudDtcblxuICAgIGlmIChjdXJyZW50RWxlbWVudCkge1xuICAgICAgY29uc3QgY29udGFpbmVySGVpZ2h0ID0gY29udGFpbmVyUmVmLmNsaWVudEhlaWdodDtcbiAgICAgIGNvbnN0IGxpbmVUb3AgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3A7XG4gICAgICBjb25zdCBsaW5lSGVpZ2h0ID0gY3VycmVudEVsZW1lbnQub2Zmc2V0SGVpZ2h0O1xuXG4gICAgICAvLyBDZW50ZXIgdGhlIGN1cnJlbnQgbGluZVxuICAgICAgY29uc3Qgc2Nyb2xsVG9wID0gbGluZVRvcCAtIGNvbnRhaW5lckhlaWdodCAvIDIgKyBsaW5lSGVpZ2h0IC8gMjtcblxuICAgICAgY29udGFpbmVyUmVmLnNjcm9sbFRvKHtcbiAgICAgICAgdG9wOiBzY3JvbGxUb3AsXG4gICAgICAgIGJlaGF2aW9yOiAnc21vb3RoJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2NvbnRhaW5lclJlZn1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2x5cmljcy1kaXNwbGF5IG92ZXJmbG93LXktYXV0byBzY3JvbGwtc21vb3RoJyxcbiAgICAgICAgJ2gtZnVsbCBweC02IHB5LTEyJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktOFwiPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmx5cmljc30+XG4gICAgICAgICAgeyhsaW5lLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICBkYXRhLWxpbmUtaW5kZXg9e2luZGV4KCl9XG4gICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAndGV4dC1jZW50ZXIgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgICAndGV4dC0yeGwgbGVhZGluZy1yZWxheGVkJyxcbiAgICAgICAgICAgICAgICBpbmRleCgpID09PSBjdXJyZW50TGluZUluZGV4KClcbiAgICAgICAgICAgICAgICAgID8gJ3RleHQtcHJpbWFyeSBmb250LXNlbWlib2xkIHNjYWxlLTExMCdcbiAgICAgICAgICAgICAgICAgIDogJ3RleHQtc2Vjb25kYXJ5IG9wYWNpdHktNjAnXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtsaW5lLnRleHR9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VIZWFkZXJQcm9wcyB7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgb25CYWNrPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IENoZXZyb25MZWZ0ID0gKCkgPT4gKFxuICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBjbGFzcz1cInctNiBoLTZcIj5cbiAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBkPVwiTTE1IDE5bC03LTcgNy03XCIgLz5cbiAgPC9zdmc+XG4pO1xuXG5leHBvcnQgY29uc3QgS2FyYW9rZUhlYWRlcjogQ29tcG9uZW50PEthcmFva2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigncmVsYXRpdmUgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBCYWNrIGJ1dHRvbiAtIGFic29sdXRlIHBvc2l0aW9uZWQgKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQmFja31cbiAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSBsZWZ0LTQgcC0yIC1tLTIgdGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgYXJpYS1sYWJlbD1cIkdvIGJhY2tcIlxuICAgICAgPlxuICAgICAgICA8Q2hldnJvbkxlZnQgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogU29uZyBpbmZvIC0gY2VudGVyZWQgKi99XG4gICAgICA8aDEgY2xhc3M9XCJ0ZXh0LWJhc2UgZm9udC1tZWRpdW0gdGV4dC1wcmltYXJ5IHRleHQtY2VudGVyIHB4LTEyIHRydW5jYXRlIG1heC13LWZ1bGxcIj5cbiAgICAgICAge3Byb3BzLnNvbmdUaXRsZX0gLSB7cHJvcHMuYXJ0aXN0fVxuICAgICAgPC9oMT5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IHR5cGUgUGxheWJhY2tTcGVlZCA9ICcxeCcgfCAnMC43NXgnIHwgJzAuNXgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNwbGl0QnV0dG9uUHJvcHMge1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuY29uc3Qgc3BlZWRzOiBQbGF5YmFja1NwZWVkW10gPSBbJzF4JywgJzAuNzV4JywgJzAuNXgnXTtcblxuZXhwb3J0IGNvbnN0IFNwbGl0QnV0dG9uOiBDb21wb25lbnQ8U3BsaXRCdXR0b25Qcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRTcGVlZEluZGV4LCBzZXRDdXJyZW50U3BlZWRJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIFxuICBjb25zdCBjdXJyZW50U3BlZWQgPSAoKSA9PiBzcGVlZHNbY3VycmVudFNwZWVkSW5kZXgoKV07XG4gIFxuICBjb25zdCBjeWNsZVNwZWVkID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnN0IG5leHRJbmRleCA9IChjdXJyZW50U3BlZWRJbmRleCgpICsgMSkgJSBzcGVlZHMubGVuZ3RoO1xuICAgIHNldEN1cnJlbnRTcGVlZEluZGV4KG5leHRJbmRleCk7XG4gICAgY29uc3QgbmV3U3BlZWQgPSBzcGVlZHNbbmV4dEluZGV4XTtcbiAgICBpZiAobmV3U3BlZWQpIHtcbiAgICAgIHByb3BzLm9uU3BlZWRDaGFuZ2U/LihuZXdTcGVlZCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3JlbGF0aXZlIGlubGluZS1mbGV4IHctZnVsbCByb3VuZGVkLWxnIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICdiZy1ncmFkaWVudC1wcmltYXJ5IHRleHQtd2hpdGUgc2hhZG93LWxnJyxcbiAgICAgICAgJ3RyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHsvKiBNYWluIGJ1dHRvbiAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25TdGFydH1cbiAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmRpc2FibGVkfVxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ2ZsZXgtMSBpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcmVsYXRpdmUgb3ZlcmZsb3ctaGlkZGVuJyxcbiAgICAgICAgICAnaC0xMiBweC02IHRleHQtbGcgZm9udC1tZWRpdW0nLFxuICAgICAgICAgICdjdXJzb3ItcG9pbnRlciBib3JkZXItbm9uZSBvdXRsaW5lLW5vbmUnLFxuICAgICAgICAgICdkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICAgJ2hvdmVyOmJnLXdoaXRlLzEwIGFjdGl2ZTpiZy13aGl0ZS8yMCdcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+U3RhcnQ8L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIERpdmlkZXIgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwidy1weCBiZy1ibGFjay8yMFwiIC8+XG4gICAgICBcbiAgICAgIHsvKiBTcGVlZCBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e2N5Y2xlU3BlZWR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcmVsYXRpdmUnLFxuICAgICAgICAgICd3LTIwIHRleHQtbGcgZm9udC1tZWRpdW0nLFxuICAgICAgICAgICdjdXJzb3ItcG9pbnRlciBib3JkZXItbm9uZSBvdXRsaW5lLW5vbmUnLFxuICAgICAgICAgICdkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICAgJ2hvdmVyOmJnLXdoaXRlLzEwIGFjdGl2ZTpiZy13aGl0ZS8yMCcsXG4gICAgICAgICAgJ2FmdGVyOmNvbnRlbnQtW1wiXCJdIGFmdGVyOmFic29sdXRlIGFmdGVyOmluc2V0LTAnLFxuICAgICAgICAgICdhZnRlcjpiZy1ncmFkaWVudC10by1yIGFmdGVyOmZyb20tdHJhbnNwYXJlbnQgYWZ0ZXI6dmlhLXdoaXRlLzIwIGFmdGVyOnRvLXRyYW5zcGFyZW50JyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNsYXRlLXgtWy0yMDAlXSBob3ZlcjphZnRlcjp0cmFuc2xhdGUteC1bMjAwJV0nLFxuICAgICAgICAgICdhZnRlcjp0cmFuc2l0aW9uLXRyYW5zZm9ybSBhZnRlcjpkdXJhdGlvbi03MDAnXG4gICAgICAgICl9XG4gICAgICAgIGFyaWEtbGFiZWw9XCJDaGFuZ2UgcGxheWJhY2sgc3BlZWRcIlxuICAgICAgPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInJlbGF0aXZlIHotMTBcIj57Y3VycmVudFNwZWVkKCl9PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBUYWIge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNQcm9wcyB7XG4gIHRhYnM6IFRhYltdO1xuICBkZWZhdWx0VGFiPzogc3RyaW5nO1xuICBvblRhYkNoYW5nZT86ICh0YWJJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNMaXN0UHJvcHMge1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNUcmlnZ2VyUHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNDb250ZW50UHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG4vLyBHbG9iYWwgc3RhdGUgZm9yIHRoZSBjdXJyZW50IHRhYnMgaW5zdGFuY2VcbmxldCBjdXJyZW50VGFic1N0YXRlOiB7XG4gIGFjdGl2ZVRhYjogKCkgPT4gc3RyaW5nO1xuICBzZXRBY3RpdmVUYWI6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xufSB8IG51bGwgPSBudWxsO1xuXG5leHBvcnQgY29uc3QgVGFiczogQ29tcG9uZW50PFRhYnNQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2FjdGl2ZVRhYiwgc2V0QWN0aXZlVGFiXSA9IGNyZWF0ZVNpZ25hbChwcm9wcy5kZWZhdWx0VGFiIHx8IHByb3BzLnRhYnNbMF0/LmlkIHx8ICcnKTtcbiAgXG4gIGNvbnN0IGhhbmRsZVRhYkNoYW5nZSA9IChpZDogc3RyaW5nKSA9PiB7XG4gICAgc2V0QWN0aXZlVGFiKGlkKTtcbiAgICBwcm9wcy5vblRhYkNoYW5nZT8uKGlkKTtcbiAgfTtcblxuICAvLyBTZXQgdGhlIGdsb2JhbCBzdGF0ZSBmb3IgY2hpbGQgY29tcG9uZW50cyB0byBhY2Nlc3NcbiAgY3VycmVudFRhYnNTdGF0ZSA9IHtcbiAgICBhY3RpdmVUYWIsXG4gICAgc2V0QWN0aXZlVGFiOiBoYW5kbGVUYWJDaGFuZ2VcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCd3LWZ1bGwnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNMaXN0OiBDb21wb25lbnQ8VGFic0xpc3RQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaC0xMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1tZCBiZy1zdXJmYWNlIHAtMSB0ZXh0LXNlY29uZGFyeScsXG4gICAgICAgICd3LWZ1bGwnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic1RyaWdnZXI6IENvbXBvbmVudDxUYWJzVHJpZ2dlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGN1cnJlbnRUYWJzU3RhdGU/LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9eygpID0+IGN1cnJlbnRUYWJzU3RhdGU/LnNldEFjdGl2ZVRhYihwcm9wcy52YWx1ZSl9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgd2hpdGVzcGFjZS1ub3dyYXAgcm91bmRlZC1zbSBweC0zIHB5LTEuNScsXG4gICAgICAgICd0ZXh0LXNtIGZvbnQtbWVkaXVtIHJpbmctb2Zmc2V0LWJhc2UgdHJhbnNpdGlvbi1hbGwnLFxuICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLWFjY2VudC1wcmltYXJ5IGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICdkaXNhYmxlZDpwb2ludGVyLWV2ZW50cy1ub25lIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAnZmxleC0xJyxcbiAgICAgICAgaXNBY3RpdmUoKVxuICAgICAgICAgID8gJ2JnLWJhc2UgdGV4dC1wcmltYXJ5IHNoYWRvdy1zbSdcbiAgICAgICAgICA6ICd0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnknLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9idXR0b24+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0NvbnRlbnQ6IENvbXBvbmVudDxUYWJzQ29udGVudFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e2N1cnJlbnRUYWJzU3RhdGU/LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnbXQtMiByaW5nLW9mZnNldC1iYXNlJyxcbiAgICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLWFjY2VudC1wcmltYXJ5IGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQXVkaW9Qcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMva2FyYW9rZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Iob3B0aW9ucz86IEF1ZGlvUHJvY2Vzc29yT3B0aW9ucykge1xuICBjb25zdCBbYXVkaW9Db250ZXh0LCBzZXRBdWRpb0NvbnRleHRdID0gY3JlYXRlU2lnbmFsPEF1ZGlvQ29udGV4dCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbWVkaWFTdHJlYW0sIHNldE1lZGlhU3RyZWFtXSA9IGNyZWF0ZVNpZ25hbDxNZWRpYVN0cmVhbSB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbYXVkaW9Xb3JrbGV0Tm9kZSwgc2V0QXVkaW9Xb3JrbGV0Tm9kZV0gPSBjcmVhdGVTaWduYWw8QXVkaW9Xb3JrbGV0Tm9kZSB8IG51bGw+KG51bGwpO1xuICBcbiAgY29uc3QgW2lzUmVhZHksIHNldElzUmVhZHldID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Vycm9yLCBzZXRFcnJvcl0gPSBjcmVhdGVTaWduYWw8RXJyb3IgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzTGlzdGVuaW5nLCBzZXRJc0xpc3RlbmluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgY29uc3QgW2N1cnJlbnRSZWNvcmRpbmdMaW5lLCBzZXRDdXJyZW50UmVjb3JkaW5nTGluZV0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtyZWNvcmRlZEF1ZGlvQnVmZmVyLCBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyXSA9IGNyZWF0ZVNpZ25hbDxGbG9hdDMyQXJyYXlbXT4oW10pO1xuICBcbiAgY29uc3QgW2lzU2Vzc2lvbkFjdGl2ZSwgc2V0SXNTZXNzaW9uQWN0aXZlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmdWxsU2Vzc2lvbkJ1ZmZlciwgc2V0RnVsbFNlc3Npb25CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBzYW1wbGVSYXRlID0gb3B0aW9ucz8uc2FtcGxlUmF0ZSB8fCAxNjAwMDtcbiAgXG4gIGNvbnN0IGluaXRpYWxpemUgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKGF1ZGlvQ29udGV4dCgpKSByZXR1cm47XG4gICAgc2V0RXJyb3IobnVsbCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBJbml0aWFsaXppbmcgYXVkaW8gY2FwdHVyZS4uLicpO1xuICAgICAgXG4gICAgICBjb25zdCBjdHggPSBuZXcgQXVkaW9Db250ZXh0KHsgc2FtcGxlUmF0ZSB9KTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChjdHgpO1xuICAgICAgXG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgc2FtcGxlUmF0ZSxcbiAgICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogZmFsc2UsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogZmFsc2UsXG4gICAgICAgICAgYXV0b0dhaW5Db250cm9sOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0TWVkaWFTdHJlYW0oc3RyZWFtKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY3R4LmF1ZGlvV29ya2xldC5hZGRNb2R1bGUoY3JlYXRlQXVkaW9Xb3JrbGV0UHJvY2Vzc29yKCkpO1xuICAgICAgXG4gICAgICBjb25zdCB3b3JrbGV0Tm9kZSA9IG5ldyBBdWRpb1dvcmtsZXROb2RlKGN0eCwgJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywge1xuICAgICAgICBudW1iZXJPZklucHV0czogMSxcbiAgICAgICAgbnVtYmVyT2ZPdXRwdXRzOiAwLFxuICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgd29ya2xldE5vZGUucG9ydC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ2F1ZGlvRGF0YScpIHtcbiAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGV2ZW50LmRhdGEuYXVkaW9EYXRhKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY3VycmVudFJlY29yZGluZ0xpbmUoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcigocHJldikgPT4gWy4uLnByZXYsIGF1ZGlvRGF0YV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaXNTZXNzaW9uQWN0aXZlKCkpIHtcbiAgICAgICAgICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKChwcmV2KSA9PiBbLi4ucHJldiwgYXVkaW9EYXRhXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICBzZXRBdWRpb1dvcmtsZXROb2RlKHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlID0gY3R4LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gICAgICBjb25zdCBnYWluTm9kZSA9IGN0eC5jcmVhdGVHYWluKCk7XG4gICAgICBnYWluTm9kZS5nYWluLnZhbHVlID0gMS4yO1xuICAgICAgXG4gICAgICBzb3VyY2UuY29ubmVjdChnYWluTm9kZSk7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgc2V0SXNSZWFkeSh0cnVlKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBBdWRpbyBjYXB0dXJlIGluaXRpYWxpemVkIHN1Y2Nlc3NmdWxseS4nKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBGYWlsZWQgdG8gaW5pdGlhbGl6ZTonLCBlKTtcbiAgICAgIHNldEVycm9yKGUgaW5zdGFuY2VvZiBFcnJvciA/IGUgOiBuZXcgRXJyb3IoJ1Vua25vd24gYXVkaW8gaW5pdGlhbGl6YXRpb24gZXJyb3InKSk7XG4gICAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjcmVhdGVBdWRpb1dvcmtsZXRQcm9jZXNzb3IgPSAoKSA9PiB7XG4gICAgY29uc3QgcHJvY2Vzc29yQ29kZSA9IGBcbiAgICAgIGNsYXNzIEthcmFva2VBdWRpb1Byb2Nlc3NvciBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7XG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgIHN1cGVyKCk7XG4gICAgICAgICAgdGhpcy5idWZmZXJTaXplID0gMTAyNDtcbiAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkgPSBbXTtcbiAgICAgICAgICB0aGlzLm1heEhpc3RvcnlMZW5ndGggPSAxMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3MoaW5wdXRzLCBvdXRwdXRzLCBwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbMF07XG4gICAgICAgICAgaWYgKGlucHV0ICYmIGlucHV0WzBdKSB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dERhdGEgPSBpbnB1dFswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0RGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBzdW0gKz0gaW5wdXREYXRhW2ldICogaW5wdXREYXRhW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgcm1zID0gTWF0aC5zcXJ0KHN1bSAvIGlucHV0RGF0YS5sZW5ndGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkucHVzaChybXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMucm1zSGlzdG9yeS5sZW5ndGggPiB0aGlzLm1heEhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5ybXNIaXN0b3J5LnNoaWZ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGF2Z1JtcyA9IHRoaXMucm1zSGlzdG9yeS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIHRoaXMucm1zSGlzdG9yeS5sZW5ndGg7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgIHR5cGU6ICdhdWRpb0RhdGEnLFxuICAgICAgICAgICAgICBhdWRpb0RhdGE6IGlucHV0RGF0YSxcbiAgICAgICAgICAgICAgcm1zTGV2ZWw6IHJtcyxcbiAgICAgICAgICAgICAgYXZnUm1zTGV2ZWw6IGF2Z1JtcyxcbiAgICAgICAgICAgICAgaXNUb29RdWlldDogYXZnUm1zIDwgMC4wMSxcbiAgICAgICAgICAgICAgaXNUb29Mb3VkOiBhdmdSbXMgPiAwLjNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVnaXN0ZXJQcm9jZXNzb3IoJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywgS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKTtcbiAgICBgO1xuICAgIFxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbcHJvY2Vzc29yQ29kZV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnIH0pO1xuICAgIHJldHVybiBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICBjdHgucmVzdW1lKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKHRydWUpO1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBTdGFydGVkIGxpc3RlbmluZyBmb3IgYXVkaW8uJyk7XG4gIH07XG4gIFxuICBjb25zdCBwYXVzZUxpc3RlbmluZyA9ICgpID0+IHtcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSA9PT0gJ3J1bm5pbmcnKSB7XG4gICAgICBjdHguc3VzcGVuZCgpO1xuICAgIH1cbiAgICBzZXRJc0xpc3RlbmluZyhmYWxzZSk7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIFBhdXNlZCBsaXN0ZW5pbmcgZm9yIGF1ZGlvLicpO1xuICB9O1xuICBcbiAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gQ2xlYW5pbmcgdXAgYXVkaW8gY2FwdHVyZS4uLicpO1xuICAgIFxuICAgIGNvbnN0IHN0cmVhbSA9IG1lZGlhU3RyZWFtKCk7XG4gICAgaWYgKHN0cmVhbSkge1xuICAgICAgc3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2goKHRyYWNrKSA9PiB0cmFjay5zdG9wKCkpO1xuICAgICAgc2V0TWVkaWFTdHJlYW0obnVsbCk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlICE9PSAnY2xvc2VkJykge1xuICAgICAgY3R4LmNsb3NlKCk7XG4gICAgICBzZXRBdWRpb0NvbnRleHQobnVsbCk7XG4gICAgfVxuICAgIFxuICAgIHNldEF1ZGlvV29ya2xldE5vZGUobnVsbCk7XG4gICAgc2V0SXNSZWFkeShmYWxzZSk7XG4gICAgc2V0SXNMaXN0ZW5pbmcoZmFsc2UpO1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBBdWRpbyBjYXB0dXJlIGNsZWFuZWQgdXAuJyk7XG4gIH07XG4gIFxuICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIFxuICBjb25zdCBzdGFydFJlY29yZGluZ0xpbmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gU3RhcnRpbmcgYXVkaW8gY2FwdHVyZSBmb3IgbGluZSAke2xpbmVJbmRleH1gKTtcbiAgICBcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZShsaW5lSW5kZXgpO1xuICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoW10pO1xuICAgIFxuICAgIGlmIChpc1JlYWR5KCkgJiYgIWlzTGlzdGVuaW5nKCkpIHtcbiAgICAgIHN0YXJ0TGlzdGVuaW5nKCk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbyA9ICgpOiBGbG9hdDMyQXJyYXlbXSA9PiB7XG4gICAgY29uc3QgbGluZUluZGV4ID0gY3VycmVudFJlY29yZGluZ0xpbmUoKTtcbiAgICBpZiAobGluZUluZGV4ID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIE5vIGFjdGl2ZSByZWNvcmRpbmcgbGluZS4nKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW9CdWZmZXIgPSByZWNvcmRlZEF1ZGlvQnVmZmVyKCk7XG4gICAgY29uc29sZS5sb2coYFtLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIFN0b3BwaW5nIGNhcHR1cmUgZm9yIGxpbmUgJHtsaW5lSW5kZXh9LiBDb2xsZWN0ZWQgJHthdWRpb0J1ZmZlci5sZW5ndGh9IGNodW5rcy5gKTtcbiAgICBcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZShudWxsKTtcbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBbLi4uYXVkaW9CdWZmZXJdO1xuICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoW10pO1xuICAgIFxuICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gTm8gYXVkaW8gY2FwdHVyZWQgZm9yIGxpbmUgJHtsaW5lSW5kZXh9LmApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICBcbiAgY29uc3QgY29udmVydEF1ZGlvVG9XYXZCbG9iID0gKGF1ZGlvQ2h1bmtzOiBGbG9hdDMyQXJyYXlbXSk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBpZiAoYXVkaW9DaHVua3MubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICBjb25zdCB0b3RhbExlbmd0aCA9IGF1ZGlvQ2h1bmtzLnJlZHVjZSgoc3VtLCBjaHVuaykgPT4gc3VtICsgY2h1bmsubGVuZ3RoLCAwKTtcbiAgICBjb25zdCBjb25jYXRlbmF0ZWQgPSBuZXcgRmxvYXQzMkFycmF5KHRvdGFsTGVuZ3RoKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGF1ZGlvQ2h1bmtzKSB7XG4gICAgICBjb25jYXRlbmF0ZWQuc2V0KGNodW5rLCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGF1ZGlvQnVmZmVyVG9XYXYoY29uY2F0ZW5hdGVkLCBzYW1wbGVSYXRlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGF1ZGlvQnVmZmVyVG9XYXYgPSAoYnVmZmVyOiBGbG9hdDMyQXJyYXksIHNhbXBsZVJhdGU6IG51bWJlcik6IEJsb2IgPT4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgY29uc3QgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBsZW5ndGggKiAyKTtcbiAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGFycmF5QnVmZmVyKTtcbiAgICBcbiAgICBjb25zdCB3cml0ZVN0cmluZyA9IChvZmZzZXQ6IG51bWJlciwgc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgd3JpdGVTdHJpbmcoMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzNiArIGxlbmd0aCAqIDIsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDgsICdXQVZFJyk7XG4gICAgd3JpdGVTdHJpbmcoMTIsICdmbXQgJyk7XG4gICAgdmlldy5zZXRVaW50MzIoMTYsIDE2LCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjIsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI0LCBzYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgc2FtcGxlUmF0ZSAqIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBsZW5ndGggKiAyLCB0cnVlKTtcbiAgICBcbiAgICBjb25zdCBvZmZzZXQgPSA0NDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzYW1wbGUgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgYnVmZmVyW2ldKSk7XG4gICAgICB2aWV3LnNldEludDE2KG9mZnNldCArIGkgKiAyLCBzYW1wbGUgKiAweDdmZmYsIHRydWUpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbmV3IEJsb2IoW2FycmF5QnVmZmVyXSwgeyB0eXBlOiAnYXVkaW8vd2F2JyB9KTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0YXJ0RnVsbFNlc3Npb24gPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIFN0YXJ0aW5nIGZ1bGwgc2Vzc2lvbiByZWNvcmRpbmcnKTtcbiAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcihbXSk7XG4gICAgc2V0SXNTZXNzaW9uQWN0aXZlKHRydWUpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2ID0gKCk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gU3RvcHBpbmcgZnVsbCBzZXNzaW9uIHJlY29yZGluZycpO1xuICAgIHNldElzU2Vzc2lvbkFjdGl2ZShmYWxzZSk7XG4gICAgXG4gICAgY29uc3Qgc2Vzc2lvbkNodW5rcyA9IGZ1bGxTZXNzaW9uQnVmZmVyKCk7XG4gICAgY29uc3Qgd2F2QmxvYiA9IGNvbnZlcnRBdWRpb1RvV2F2QmxvYihzZXNzaW9uQ2h1bmtzKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBGdWxsIHNlc3Npb246ICR7c2Vzc2lvbkNodW5rcy5sZW5ndGh9IGNodW5rcywgYCArXG4gICAgICAgIGAke3dhdkJsb2IgPyAod2F2QmxvYi5zaXplIC8gMTAyNCkudG9GaXhlZCgxKSArICdLQicgOiAnbnVsbCd9YFxuICAgICk7XG4gICAgXG4gICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoW10pO1xuICAgIFxuICAgIHJldHVybiB3YXZCbG9iO1xuICB9O1xuICBcbiAgcmV0dXJuIHtcbiAgICBpc1JlYWR5LFxuICAgIGVycm9yLFxuICAgIGlzTGlzdGVuaW5nLFxuICAgIGlzU2Vzc2lvbkFjdGl2ZSxcbiAgICBcbiAgICBpbml0aWFsaXplLFxuICAgIHN0YXJ0TGlzdGVuaW5nLFxuICAgIHBhdXNlTGlzdGVuaW5nLFxuICAgIGNsZWFudXAsXG4gICAgc3RhcnRSZWNvcmRpbmdMaW5lLFxuICAgIHN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8sXG4gICAgY29udmVydEF1ZGlvVG9XYXZCbG9iLFxuICAgIFxuICAgIHN0YXJ0RnVsbFNlc3Npb24sXG4gICAgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2LFxuICB9O1xufSIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgY3JlYXRlTWVtbyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgS2FyYW9rZURhdGEsIEthcmFva2VTZXNzaW9uLCBMaW5lU2NvcmUsIFdvcmRUaW1pbmcgfSBmcm9tICcuLi90eXBlcy9rYXJhb2tlJztcblxuZXhwb3J0IHR5cGUgQ29ubmVjdGlvblN0YXR1cyA9ICdjb25uZWN0aW5nJyB8ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcgfCAnbm8ta2FyYW9rZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVLYXJhb2tlU3RvcmUoKSB7XG4gIGNvbnN0IFtrYXJhb2tlRGF0YSwgc2V0S2FyYW9rZURhdGFdID0gY3JlYXRlU2lnbmFsPEthcmFva2VEYXRhIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtjdXJyZW50U2Vzc2lvbiwgc2V0Q3VycmVudFNlc3Npb25dID0gY3JlYXRlU2lnbmFsPEthcmFva2VTZXNzaW9uIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtjb25uZWN0aW9uU3RhdHVzLCBzZXRDb25uZWN0aW9uU3RhdHVzXSA9IGNyZWF0ZVNpZ25hbDxDb25uZWN0aW9uU3RhdHVzPignZGlzY29ubmVjdGVkJyk7XG4gIGNvbnN0IFtpc0thcmFva2VBY3RpdmUsIHNldElzS2FyYW9rZUFjdGl2ZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgY29uc3QgW2lzUmVjb3JkaW5nLCBzZXRJc1JlY29yZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY3VycmVudFJlY29yZGluZ0xpbmUsIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCB1bmRlZmluZWQ+KCk7XG4gIFxuICBjb25zdCBbbGluZVNjb3Jlcywgc2V0TGluZVNjb3Jlc10gPSBjcmVhdGVTaWduYWw8TWFwPG51bWJlciwgTGluZVNjb3JlPj4obmV3IE1hcCgpKTtcbiAgY29uc3QgW3RvdGFsU2NvcmUsIHNldFRvdGFsU2NvcmVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbY3VycmVudE11bHRpcGxpZXIsIHNldEN1cnJlbnRNdWx0aXBsaWVyXSA9IGNyZWF0ZVNpZ25hbCgxKTtcbiAgY29uc3QgW3N0cmVha0NvdW50LCBzZXRTdHJlYWtDb3VudF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtjb21wbGV0ZWRMaW5lcywgc2V0Q29tcGxldGVkTGluZXNdID0gY3JlYXRlU2lnbmFsKDApO1xuICBcbiAgY29uc3QgW2N1cnJlbnRXb3JkRmVlZGJhY2ssIHNldEN1cnJlbnRXb3JkRmVlZGJhY2tdID0gY3JlYXRlU2lnbmFsPHtcbiAgICB3b3JkVGltaW5ncz86IFdvcmRUaW1pbmdbXTtcbiAgICB3b3JkU2NvcmVzPzogQXJyYXk8eyBleHBlY3RlZDogc3RyaW5nOyB0cmFuc2NyaWJlZDogc3RyaW5nOyBzY29yZTogbnVtYmVyIH0+O1xuICB9IHwgbnVsbD4obnVsbCk7XG4gIFxuICBjb25zdCBwZXJmb3JtYW5jZVNjb3JlID0gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY29tcGxldGVkID0gY29tcGxldGVkTGluZXMoKTtcbiAgICBjb25zdCB0b3RhbCA9IGthcmFva2VEYXRhKCk/Lmx5cmljcz8udG90YWxfbGluZXMgfHwgMDtcbiAgICBcbiAgICBpZiAoY29tcGxldGVkID09PSAwIHx8IHRvdGFsID09PSAwKSByZXR1cm4gMDtcbiAgICBcbiAgICBjb25zdCBhdmdTY29yZSA9IHRvdGFsU2NvcmUoKSAvIGNvbXBsZXRlZDtcbiAgICBjb25zdCBjb21wbGV0aW9uQm9udXMgPSAoY29tcGxldGVkIC8gdG90YWwpICogMjA7XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWluKDEwMCwgYXZnU2NvcmUgKyBjb21wbGV0aW9uQm9udXMpO1xuICB9KTtcbiAgXG4gIGNvbnN0IHBlcmZvcm1hbmNlU3RhdGUgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBzY29yZSA9IHBlcmZvcm1hbmNlU2NvcmUoKTtcbiAgICBpZiAoc2NvcmUgPj0gOTApIHJldHVybiAnZXhjZWxsZW50JztcbiAgICBpZiAoc2NvcmUgPj0gNzUpIHJldHVybiAnZ29vZCc7XG4gICAgaWYgKHNjb3JlID49IDYwKSByZXR1cm4gJ2F2ZXJhZ2UnO1xuICAgIHJldHVybiAnbmVlZHMtcHJhY3RpY2UnO1xuICB9KTtcbiAgXG4gIGNvbnN0IHVwZGF0ZUxpbmVTY29yZSA9IChsaW5lSW5kZXg6IG51bWJlciwgc2NvcmU6IExpbmVTY29yZSkgPT4ge1xuICAgIGNvbnN0IHByZXZpb3VzU2NvcmUgPSBsaW5lU2NvcmVzKCkuZ2V0KGxpbmVJbmRleCk7XG4gICAgY29uc3QgbmV3TGluZVNjb3JlcyA9IG5ldyBNYXAobGluZVNjb3JlcygpKTtcbiAgICBuZXdMaW5lU2NvcmVzLnNldChsaW5lSW5kZXgsIHNjb3JlKTtcbiAgICBzZXRMaW5lU2NvcmVzKG5ld0xpbmVTY29yZXMpO1xuICAgIFxuICAgIGNvbnN0IHNjb3JlV2l0aE11bHRpcGxpZXIgPSBNYXRoLnJvdW5kKHNjb3JlLnNjb3JlICogY3VycmVudE11bHRpcGxpZXIoKSk7XG4gICAgXG4gICAgaWYgKCFwcmV2aW91c1Njb3JlKSB7XG4gICAgICBzZXRUb3RhbFNjb3JlKChwcmV2KSA9PiBwcmV2ICsgc2NvcmVXaXRoTXVsdGlwbGllcik7XG4gICAgICBzZXRDb21wbGV0ZWRMaW5lcygocHJldikgPT4gcHJldiArIDEpO1xuICAgICAgXG4gICAgICBpZiAoc2NvcmUuc2NvcmUgPj0gODUpIHtcbiAgICAgICAgc2V0U3RyZWFrQ291bnQoKHByZXYpID0+IHByZXYgKyAxKTtcbiAgICAgICAgaWYgKHN0cmVha0NvdW50KCkgPj0gMykge1xuICAgICAgICAgIHNldEN1cnJlbnRNdWx0aXBsaWVyKE1hdGgubWluKGN1cnJlbnRNdWx0aXBsaWVyKCkgKyAwLjUsIDMpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0U3RyZWFrQ291bnQoMCk7XG4gICAgICAgIHNldEN1cnJlbnRNdWx0aXBsaWVyKDEpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwcmV2aW91c1Njb3JlV2l0aE11bHRpcGxpZXIgPSBNYXRoLnJvdW5kKHByZXZpb3VzU2NvcmUuc2NvcmUpO1xuICAgICAgc2V0VG90YWxTY29yZSgocHJldikgPT4gcHJldiAtIHByZXZpb3VzU2NvcmVXaXRoTXVsdGlwbGllciArIHNjb3JlV2l0aE11bHRpcGxpZXIpO1xuICAgIH1cbiAgICBcbiAgICBpZiAoc2NvcmUud29yZFRpbWluZ3MgfHwgc2NvcmUud29yZFNjb3Jlcykge1xuICAgICAgc2V0Q3VycmVudFdvcmRGZWVkYmFjayh7XG4gICAgICAgIHdvcmRUaW1pbmdzOiBzY29yZS53b3JkVGltaW5ncyxcbiAgICAgICAgd29yZFNjb3Jlczogc2NvcmUud29yZFNjb3JlcyxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgc2V0Q3VycmVudFdvcmRGZWVkYmFjayhudWxsKTtcbiAgICAgIH0sIDMwMDApO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IHJlc2V0U2NvcmluZyA9ICgpID0+IHtcbiAgICBzZXRMaW5lU2NvcmVzKG5ldyBNYXAoKSk7XG4gICAgc2V0VG90YWxTY29yZSgwKTtcbiAgICBzZXRDdXJyZW50TXVsdGlwbGllcigxKTtcbiAgICBzZXRTdHJlYWtDb3VudCgwKTtcbiAgICBzZXRDb21wbGV0ZWRMaW5lcygwKTtcbiAgICBzZXRDdXJyZW50V29yZEZlZWRiYWNrKG51bGwpO1xuICB9O1xuICBcbiAgcmV0dXJuIHtcbiAgICBrYXJhb2tlRGF0YSxcbiAgICBzZXRLYXJhb2tlRGF0YSxcbiAgICBjdXJyZW50U2Vzc2lvbixcbiAgICBzZXRDdXJyZW50U2Vzc2lvbixcbiAgICBjb25uZWN0aW9uU3RhdHVzLFxuICAgIHNldENvbm5lY3Rpb25TdGF0dXMsXG4gICAgaXNLYXJhb2tlQWN0aXZlLFxuICAgIHNldElzS2FyYW9rZUFjdGl2ZSxcbiAgICBcbiAgICBpc1JlY29yZGluZyxcbiAgICBzZXRJc1JlY29yZGluZyxcbiAgICBjdXJyZW50UmVjb3JkaW5nTGluZSxcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZSxcbiAgICBcbiAgICBsaW5lU2NvcmVzLFxuICAgIHRvdGFsU2NvcmUsXG4gICAgY3VycmVudE11bHRpcGxpZXIsXG4gICAgc3RyZWFrQ291bnQsXG4gICAgY29tcGxldGVkTGluZXMsXG4gICAgcGVyZm9ybWFuY2VTY29yZSxcbiAgICBwZXJmb3JtYW5jZVN0YXRlLFxuICAgIFxuICAgIGN1cnJlbnRXb3JkRmVlZGJhY2ssXG4gICAgXG4gICAgdXBkYXRlTGluZVNjb3JlLFxuICAgIHJlc2V0U2NvcmluZyxcbiAgfTtcbn0iLCJpbXBvcnQgdHlwZSB7IEthcmFva2VEYXRhLCBLYXJhb2tlU2Vzc2lvbiwgTGluZVNjb3JlLCBTZXNzaW9uUmVzdWx0cyB9IGZyb20gJy4uLy4uL3R5cGVzL2thcmFva2UnO1xuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNlcnZlclVybDogc3RyaW5nID0gaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBJX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3Jykge31cblxuICBhc3luYyBmZXRjaEthcmFva2VEYXRhKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICB0aXRsZT86IHN0cmluZyxcbiAgICBhcnRpc3Q/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChgJHt0aGlzLnNlcnZlclVybH0vYXBpL2thcmFva2UvJHt0cmFja0lkfWApO1xuICAgICAgaWYgKHRpdGxlKSB1cmwuc2VhcmNoUGFyYW1zLnNldCgndGl0bGUnLCB0aXRsZSk7XG4gICAgICBpZiAoYXJ0aXN0KSB1cmwuc2VhcmNoUGFyYW1zLnNldCgnYXJ0aXN0JywgYXJ0aXN0KTtcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwudG9TdHJpbmcoKSk7XG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7IHRpdGxlOiBzdHJpbmc7IGFydGlzdDogc3RyaW5nOyBnZW5pdXNfaWQ/OiBzdHJpbmcgfSxcbiAgICBhdXRoVG9rZW46IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuc2VydmVyVXJsfS9hcGkva2FyYW9rZS9zdGFydGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke2F1dGhUb2tlbn1gLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdHJhY2tfaWQ6IHRyYWNrSWQsXG4gICAgICAgICAgc29uZ19kYXRhOiBzb25nRGF0YSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiBkYXRhLnNlc3Npb247XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMsIGF3YWl0IHJlc3BvbnNlLnRleHQoKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdyYWRlUmVjb3JkaW5nKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGxpbmVJbmRleDogbnVtYmVyLFxuICAgIGF1ZGlvRGF0YTogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dDogc3RyaW5nLFxuICAgIGF0dGVtcHROdW1iZXI6IG51bWJlcixcbiAgICBhdXRoVG9rZW46IHN0cmluZ1xuICApOiBQcm9taXNlPExpbmVTY29yZSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLnNlcnZlclVybH0vYXBpL2thcmFva2UvZ3JhZGVgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHthdXRoVG9rZW59YCxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHNlc3Npb25faWQ6IHNlc3Npb25JZCxcbiAgICAgICAgICBsaW5lX2luZGV4OiBsaW5lSW5kZXgsXG4gICAgICAgICAgYXVkaW9fZGF0YTogYXVkaW9EYXRhLFxuICAgICAgICAgIGV4cGVjdGVkX3RleHQ6IGV4cGVjdGVkVGV4dCxcbiAgICAgICAgICBhdHRlbXB0X251bWJlcjogYXR0ZW1wdE51bWJlcixcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzY29yZTogTWF0aC5yb3VuZChyZXN1bHQuc2NvcmUpLFxuICAgICAgICAgIGZlZWRiYWNrOiByZXN1bHQuZmVlZGJhY2ssXG4gICAgICAgICAgYXR0ZW1wdHM6IHJlc3VsdC5hdHRlbXB0cyxcbiAgICAgICAgICB3b3JkVGltaW5nczogcmVzdWx0LndvcmRfdGltaW5ncyxcbiAgICAgICAgICB3b3JkU2NvcmVzOiByZXN1bHQud29yZF9zY29yZXMsXG4gICAgICAgICAgdHJhbnNjcmlwdGlvbkNvbmZpZGVuY2U6IHJlc3VsdC50cmFuc2NyaXB0aW9uX2NvbmZpZGVuY2UsXG4gICAgICAgICAgdHJhbnNjcmlwdDogcmVzdWx0LnRyYW5zY3JpcHQsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBncmFkZSByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY29tcGxldGVTZXNzaW9uKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIHNlc3Npb25BdWRpb0RhdGE6IHN0cmluZyxcbiAgICBseXJpY3NXaXRoVGltaW5nOiBhbnlbXSxcbiAgICBhdXRoVG9rZW46IHN0cmluZ1xuICApOiBQcm9taXNlPFNlc3Npb25SZXN1bHRzIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuc2VydmVyVXJsfS9hcGkva2FyYW9rZS9jb21wbGV0ZWAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke2F1dGhUb2tlbn1gLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc2Vzc2lvbl9pZDogc2Vzc2lvbklkLFxuICAgICAgICAgIGF1ZGlvX2RhdGE6IHNlc3Npb25BdWRpb0RhdGEsXG4gICAgICAgICAgbHlyaWNzX3dpdGhfdGltaW5nOiBseXJpY3NXaXRoVGltaW5nLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0VXNlckJlc3RTY29yZShzb25nSWQ6IHN0cmluZywgYXV0aFRva2VuOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcbiAgICAgICAgYCR7dGhpcy5zZXJ2ZXJVcmx9L2FwaS91c2Vycy9tZS9zb25ncy8ke3NvbmdJZH0vYmVzdC1zY29yZWAsXG4gICAgICAgIHtcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHthdXRoVG9rZW59YCxcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiBkYXRhLmJlc3RTY29yZSB8fCBudWxsO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZldGNoIGJlc3Qgc2NvcmUnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCB1c2VyIGJlc3Qgc2NvcmU6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0U29uZ0xlYWRlcmJvYXJkKHNvbmdJZDogc3RyaW5nLCBsaW1pdDogbnVtYmVyID0gMTApOiBQcm9taXNlPGFueVtdPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICAgIGAke3RoaXMuc2VydmVyVXJsfS9hcGkvc29uZ3MvJHtzb25nSWR9L2xlYWRlcmJvYXJkP2xpbWl0PSR7bGltaXR9YFxuICAgICAgKTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiBkYXRhLmVudHJpZXMgfHwgW107XG4gICAgICB9XG4gICAgICByZXR1cm4gW107XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2ggbGVhZGVyYm9hcmQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufSIsImltcG9ydCB0eXBlIHsgS2FyYW9rZUxpbmUsIENodW5rSW5mbyB9IGZyb20gJy4uLy4uL3R5cGVzL2thcmFva2UnO1xuXG5jb25zdCBNSU5fV09SRFMgPSA4O1xuY29uc3QgTUFYX1dPUkRTID0gMTU7XG5jb25zdCBNQVhfTElORVNfUEVSX0NIVU5LID0gMztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvdW50V29yZHModGV4dDogc3RyaW5nKTogbnVtYmVyIHtcbiAgcmV0dXJuIHRleHRcbiAgICAudHJpbSgpXG4gICAgLnNwbGl0KC9cXHMrLylcbiAgICAuZmlsdGVyKCh3b3JkKSA9PiB3b3JkLmxlbmd0aCA+IDApLmxlbmd0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENodW5rTGluZXMoXG4gIGxpbmVzOiBLYXJhb2tlTGluZVtdLFxuICBzdGFydEluZGV4OiBudW1iZXJcbik6IENodW5rSW5mbyB7XG4gIGxldCB0b3RhbFdvcmRzID0gMDtcbiAgbGV0IGVuZEluZGV4ID0gc3RhcnRJbmRleDtcbiAgY29uc3QgZXhwZWN0ZWRUZXh0czogc3RyaW5nW10gPSBbXTtcblxuICB3aGlsZSAoZW5kSW5kZXggPCBsaW5lcy5sZW5ndGggJiYgdG90YWxXb3JkcyA8IE1JTl9XT1JEUykge1xuICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tlbmRJbmRleF07XG4gICAgY29uc3Qgd29yZHMgPSBjb3VudFdvcmRzKGxpbmUudGV4dCk7XG5cbiAgICBpZiAodG90YWxXb3JkcyArIHdvcmRzID4gTUFYX1dPUkRTICYmIHRvdGFsV29yZHMgPj0gNSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgZXhwZWN0ZWRUZXh0cy5wdXNoKGxpbmUudGV4dCk7XG4gICAgdG90YWxXb3JkcyArPSB3b3JkcztcbiAgICBlbmRJbmRleCsrO1xuXG4gICAgaWYgKGVuZEluZGV4IC0gc3RhcnRJbmRleCA+PSBNQVhfTElORVNfUEVSX0NIVU5LKSBicmVhaztcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc3RhcnRJbmRleCxcbiAgICBlbmRJbmRleDogZW5kSW5kZXggLSAxLFxuICAgIGV4cGVjdGVkVGV4dDogZXhwZWN0ZWRUZXh0cy5qb2luKCcgJyksXG4gICAgd29yZENvdW50OiB0b3RhbFdvcmRzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24oXG4gIGxpbmVzOiBLYXJhb2tlTGluZVtdLFxuICBjaHVua0luZm86IENodW5rSW5mb1xuKTogbnVtYmVyIHtcbiAgY29uc3QgeyBzdGFydEluZGV4LCBlbmRJbmRleCB9ID0gY2h1bmtJbmZvO1xuICBjb25zdCBsaW5lID0gbGluZXNbc3RhcnRJbmRleF07XG4gIFxuICBpZiAoIWxpbmUpIHJldHVybiAzMDAwO1xuXG4gIGlmIChlbmRJbmRleCA+IHN0YXJ0SW5kZXgpIHtcbiAgICBjb25zdCBsYXN0TGluZSA9IGxpbmVzW2VuZEluZGV4XTtcbiAgICBcbiAgICBpZiAobGluZS5yZWNvcmRpbmdTdGFydCAmJiBsYXN0TGluZS5yZWNvcmRpbmdFbmQpIHtcbiAgICAgIHJldHVybiBsYXN0TGluZS5yZWNvcmRpbmdFbmQgLSBsaW5lLnJlY29yZGluZ1N0YXJ0O1xuICAgIH0gZWxzZSBpZiAoZW5kSW5kZXggKyAxIDwgbGluZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0TGluZSA9IGxpbmVzW2VuZEluZGV4ICsgMV07XG4gICAgICByZXR1cm4gbmV4dExpbmUudGltZXN0YW1wIC0gbGluZS50aW1lc3RhbXA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8PSBlbmRJbmRleDsgaSsrKSB7XG4gICAgICAgIGR1cmF0aW9uICs9IGxpbmVzW2ldLmR1cmF0aW9uIHx8IDMwMDA7XG4gICAgICB9XG4gICAgICByZXR1cm4gTWF0aC5taW4oZHVyYXRpb24sIDgwMDApO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAobGluZS5yZWNvcmRpbmdTdGFydCAmJiBsaW5lLnJlY29yZGluZ0VuZCkge1xuICAgICAgcmV0dXJuIGxpbmUucmVjb3JkaW5nRW5kIC0gbGluZS5yZWNvcmRpbmdTdGFydDtcbiAgICB9IGVsc2UgaWYgKHN0YXJ0SW5kZXggKyAxIDwgbGluZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0TGluZSA9IGxpbmVzW3N0YXJ0SW5kZXggKyAxXTtcbiAgICAgIGNvbnN0IGNhbGN1bGF0ZWREdXJhdGlvbiA9IG5leHRMaW5lLnRpbWVzdGFtcCAtIGxpbmUudGltZXN0YW1wO1xuICAgICAgcmV0dXJuIE1hdGgubWluKE1hdGgubWF4KGNhbGN1bGF0ZWREdXJhdGlvbiwgMTAwMCksIDUwMDApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTWF0aC5taW4obGluZS5kdXJhdGlvbiB8fCAzMDAwLCA1MDAwKTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQgeyBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgdHlwZSB7IEpTWCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbidcblxuZXhwb3J0IGludGVyZmFjZSBDYXJkUHJvcHMgZXh0ZW5kcyBKU1guSFRNTEF0dHJpYnV0ZXM8SFRNTERpdkVsZW1lbnQ+IHtcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdvdXRsaW5lZCcgfCAnZWxldmF0ZWQnXG4gIHBhZGRpbmc/OiAnbm9uZScgfCAnc20nIHwgJ21kJyB8ICdsZydcbn1cblxuZXhwb3J0IGNvbnN0IENhcmQgPSAocHJvcHM6IENhcmRQcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXG4gICAgJ3ZhcmlhbnQnLFxuICAgICdwYWRkaW5nJyxcbiAgICAnY2xhc3MnLFxuICAgICdjaGlsZHJlbicsXG4gIF0pXG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IGxvY2FsLnZhcmlhbnQgfHwgJ2RlZmF1bHQnXG4gIGNvbnN0IHBhZGRpbmcgPSAoKSA9PiBsb2NhbC5wYWRkaW5nIHx8ICdtZCdcblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3JvdW5kZWQteGwgdHJhbnNpdGlvbi1hbGwnLFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVmFyaWFudHNcbiAgICAgICAgICAnYmctc3VyZmFjZSBib3JkZXIgYm9yZGVyLXN1YnRsZSc6IHZhcmlhbnQoKSA9PT0gJ2RlZmF1bHQnLFxuICAgICAgICAgICdiZy10cmFuc3BhcmVudCBib3JkZXItMiBib3JkZXItZGVmYXVsdCc6IHZhcmlhbnQoKSA9PT0gJ291dGxpbmVkJyxcbiAgICAgICAgICAnYmctZWxldmF0ZWQgc2hhZG93LXhsIGhvdmVyOnNoYWRvdy0yeGwgaG92ZXI6dHJhbnNsYXRlLXktWy0ycHhdJzogdmFyaWFudCgpID09PSAnZWxldmF0ZWQnLFxuICAgICAgICAgIC8vIFBhZGRpbmdcbiAgICAgICAgICAncC0wJzogcGFkZGluZygpID09PSAnbm9uZScsXG4gICAgICAgICAgJ3AtMyc6IHBhZGRpbmcoKSA9PT0gJ3NtJyxcbiAgICAgICAgICAncC02JzogcGFkZGluZygpID09PSAnbWQnLFxuICAgICAgICAgICdwLTgnOiBwYWRkaW5nKCkgPT09ICdsZycsXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2FsLmNsYXNzXG4gICAgICApfVxuICAgICAgey4uLm90aGVyc31cbiAgICA+XG4gICAgICB7bG9jYWwuY2hpbGRyZW59XG4gICAgPC9kaXY+XG4gIClcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDYXJkSGVhZGVyUHJvcHMgZXh0ZW5kcyBKU1guSFRNTEF0dHJpYnV0ZXM8SFRNTERpdkVsZW1lbnQ+IHt9XG5cbmV4cG9ydCBjb25zdCBDYXJkSGVhZGVyID0gKHByb3BzOiBDYXJkSGVhZGVyUHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgWydjbGFzcycsICdjaGlsZHJlbiddKVxuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgY2xhc3M9e2NuKCdtYi00JywgbG9jYWwuY2xhc3MpfVxuICAgICAgey4uLm90aGVyc31cbiAgICA+XG4gICAgICB7bG9jYWwuY2hpbGRyZW59XG4gICAgPC9kaXY+XG4gIClcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDYXJkVGl0bGVQcm9wcyBleHRlbmRzIEpTWC5IVE1MQXR0cmlidXRlczxIVE1MSGVhZGluZ0VsZW1lbnQ+IHt9XG5cbmV4cG9ydCBjb25zdCBDYXJkVGl0bGUgPSAocHJvcHM6IENhcmRUaXRsZVByb3BzKSA9PiB7XG4gIGNvbnN0IFtsb2NhbCwgb3RoZXJzXSA9IHNwbGl0UHJvcHMocHJvcHMsIFsnY2xhc3MnLCAnY2hpbGRyZW4nXSlcblxuICByZXR1cm4gKFxuICAgIDxoM1xuICAgICAgY2xhc3M9e2NuKCd0ZXh0LXhsIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5JywgbG9jYWwuY2xhc3MpfVxuICAgICAgey4uLm90aGVyc31cbiAgICA+XG4gICAgICB7bG9jYWwuY2hpbGRyZW59XG4gICAgPC9oMz5cbiAgKVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENhcmREZXNjcmlwdGlvblByb3BzIGV4dGVuZHMgSlNYLkhUTUxBdHRyaWJ1dGVzPEhUTUxQYXJhZ3JhcGhFbGVtZW50PiB7fVxuXG5leHBvcnQgY29uc3QgQ2FyZERlc2NyaXB0aW9uID0gKHByb3BzOiBDYXJkRGVzY3JpcHRpb25Qcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbJ2NsYXNzJywgJ2NoaWxkcmVuJ10pXG5cbiAgcmV0dXJuIChcbiAgICA8cFxuICAgICAgY2xhc3M9e2NuKCd0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTEnLCBsb2NhbC5jbGFzcyl9XG4gICAgICB7Li4ub3RoZXJzfVxuICAgID5cbiAgICAgIHtsb2NhbC5jaGlsZHJlbn1cbiAgICA8L3A+XG4gIClcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDYXJkQ29udGVudFByb3BzIGV4dGVuZHMgSlNYLkhUTUxBdHRyaWJ1dGVzPEhUTUxEaXZFbGVtZW50PiB7fVxuXG5leHBvcnQgY29uc3QgQ2FyZENvbnRlbnQgPSAocHJvcHM6IENhcmRDb250ZW50UHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgWydjbGFzcycsICdjaGlsZHJlbiddKVxuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgY2xhc3M9e2NuKCcnLCBsb2NhbC5jbGFzcyl9XG4gICAgICB7Li4ub3RoZXJzfVxuICAgID5cbiAgICAgIHtsb2NhbC5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENhcmRGb290ZXJQcm9wcyBleHRlbmRzIEpTWC5IVE1MQXR0cmlidXRlczxIVE1MRGl2RWxlbWVudD4ge31cblxuZXhwb3J0IGNvbnN0IENhcmRGb290ZXIgPSAocHJvcHM6IENhcmRGb290ZXJQcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbJ2NsYXNzJywgJ2NoaWxkcmVuJ10pXG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjbGFzcz17Y24oJ210LTYgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuJywgbG9jYWwuY2xhc3MpfVxuICAgICAgey4uLm90aGVyc31cbiAgICA+XG4gICAgICB7bG9jYWwuY2hpbGRyZW59XG4gICAgPC9kaXY+XG4gIClcbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2dyZXNzQmFyUHJvcHMge1xuICBjdXJyZW50OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUHJvZ3Jlc3NCYXI6IENvbXBvbmVudDxQcm9ncmVzc0JhclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBwZXJjZW50YWdlID0gKCkgPT4gTWF0aC5taW4oMTAwLCBNYXRoLm1heCgwLCAocHJvcHMuY3VycmVudCAvIHByb3BzLnRvdGFsKSAqIDEwMCkpO1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigndy1mdWxsIGgtMS41IGJnLWhpZ2hsaWdodCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwiaC1mdWxsIGJnLWFjY2VudCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAgZWFzZS1vdXQgcm91bmRlZC1yLXNtXCJcbiAgICAgICAgc3R5bGU9e3sgd2lkdGg6IGAke3BlcmNlbnRhZ2UoKX0lYCB9fVxuICAgICAgLz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgRm9yIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCB7IENhcmQgfSBmcm9tICcuLi8uLi9jb21tb24vQ2FyZCc7XG5pbXBvcnQgeyBQcm9ncmVzc0JhciB9IGZyb20gJy4uLy4uL2NvbW1vbi9Qcm9ncmVzc0Jhcic7XG5pbXBvcnQgdHlwZSB7IFNlc3Npb25SZXN1bHRzIH0gZnJvbSAnLi4vLi4vLi4vdHlwZXMva2FyYW9rZSc7XG5pbXBvcnQgc3R5bGVzIGZyb20gJy4vS2FyYW9rZUNvbXBsZXRpb24ubW9kdWxlLmNzcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZUNvbXBsZXRpb25Qcm9wcyB7XG4gIG92ZXJhbGxTY29yZTogbnVtYmVyO1xuICBzb25nOiB7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgfTtcbiAgbGluZVJlc3VsdHM6IFNlc3Npb25SZXN1bHRzWydsaW5lUmVzdWx0cyddO1xuICBpc0FuYWx5emluZzogYm9vbGVhbjtcbiAgaXNOZXdCZXN0U2NvcmU6IGJvb2xlYW47XG4gIG9uVHJ5QWdhaW4/OiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgS2FyYW9rZUNvbXBsZXRpb246IENvbXBvbmVudDxLYXJhb2tlQ29tcGxldGlvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBnZXRHcmFkZSA9IChzY29yZTogbnVtYmVyKTogc3RyaW5nID0+IHtcbiAgICBpZiAoc2NvcmUgPj0gOTUpIHJldHVybiAnUyc7XG4gICAgaWYgKHNjb3JlID49IDkwKSByZXR1cm4gJ0ErJztcbiAgICBpZiAoc2NvcmUgPj0gODUpIHJldHVybiAnQSc7XG4gICAgaWYgKHNjb3JlID49IDgwKSByZXR1cm4gJ0IrJztcbiAgICBpZiAoc2NvcmUgPj0gNzUpIHJldHVybiAnQic7XG4gICAgaWYgKHNjb3JlID49IDcwKSByZXR1cm4gJ0MrJztcbiAgICBpZiAoc2NvcmUgPj0gNjUpIHJldHVybiAnQyc7XG4gICAgaWYgKHNjb3JlID49IDYwKSByZXR1cm4gJ0QnO1xuICAgIHJldHVybiAnRic7XG4gIH07XG5cbiAgY29uc3QgZ2V0R3JhZGVDb2xvciA9IChncmFkZTogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgICBzd2l0Y2ggKGdyYWRlKSB7XG4gICAgICBjYXNlICdTJzogcmV0dXJuICcjRkZENzAwJztcbiAgICAgIGNhc2UgJ0ErJzpcbiAgICAgIGNhc2UgJ0EnOiByZXR1cm4gJyM0Q0FGNTAnO1xuICAgICAgY2FzZSAnQisnOlxuICAgICAgY2FzZSAnQic6IHJldHVybiAnIzIxOTZGMyc7XG4gICAgICBjYXNlICdDKyc6XG4gICAgICBjYXNlICdDJzogcmV0dXJuICcjRkY5ODAwJztcbiAgICAgIGNhc2UgJ0QnOiByZXR1cm4gJyNGNDQzMzYnO1xuICAgICAgY2FzZSAnRic6IHJldHVybiAnIzlFOUU5RSc7XG4gICAgICBkZWZhdWx0OiByZXR1cm4gJyM5RTlFOUUnO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBnZXRGZWVkYmFjayA9IChzY29yZTogbnVtYmVyKTogc3RyaW5nID0+IHtcbiAgICBpZiAoc2NvcmUgPj0gOTUpIHJldHVybiBcIlBlcmZlY3QhIFlvdSdyZSBhIGthcmFva2UgbGVnZW5kISDwn4yfXCI7XG4gICAgaWYgKHNjb3JlID49IDg1KSByZXR1cm4gXCJFeGNlbGxlbnQgcGVyZm9ybWFuY2UhIEtlZXAgaXQgdXAhIPCfjqRcIjtcbiAgICBpZiAoc2NvcmUgPj0gNzUpIHJldHVybiBcIkdyZWF0IGpvYiEgWW91J3JlIGdldHRpbmcgdGhlcmUhIPCfjrVcIjtcbiAgICBpZiAoc2NvcmUgPj0gNjUpIHJldHVybiBcIkdvb2QgZWZmb3J0ISBQcmFjdGljZSBtYWtlcyBwZXJmZWN0ISDwn462XCI7XG4gICAgaWYgKHNjb3JlID49IDU1KSByZXR1cm4gXCJOaWNlIHRyeSEgS2VlcCBwcmFjdGljaW5nISDwn5KqXCI7XG4gICAgcmV0dXJuIFwiRG9uJ3QgZ2l2ZSB1cCEgRXZlcnkgbGVnZW5kIHN0YXJ0cyBzb21ld2hlcmUhIPCfjLFcIjtcbiAgfTtcblxuICBjb25zdCBncmFkZSA9ICgpID0+IGdldEdyYWRlKHByb3BzLm92ZXJhbGxTY29yZSk7XG4gIGNvbnN0IGdyYWRlQ29sb3IgPSAoKSA9PiBnZXRHcmFkZUNvbG9yKGdyYWRlKCkpO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17c3R5bGVzLmNvbXBsZXRpb259PlxuICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNBbmFseXppbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgPD5cbiAgICAgICAgICA8ZGl2IGNsYXNzPXtzdHlsZXMuaGVhZGVyfT5cbiAgICAgICAgICAgIDxoMiBjbGFzcz17c3R5bGVzLnRpdGxlfT5QZXJmb3JtYW5jZSBDb21wbGV0ZSE8L2gyPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNOZXdCZXN0U2NvcmV9PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPXtzdHlsZXMubmV3QmVzdFNjb3JlfT7wn4+GIE5ldyBQZXJzb25hbCBCZXN0ITwvZGl2PlxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgPENhcmQgY2xhc3M9e3N0eWxlcy5zY29yZUNhcmR9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17c3R5bGVzLnNvbmdJbmZvfT5cbiAgICAgICAgICAgICAgPGgzPntwcm9wcy5zb25nLnRpdGxlfTwvaDM+XG4gICAgICAgICAgICAgIDxwPntwcm9wcy5zb25nLmFydGlzdH08L3A+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPGRpdiBjbGFzcz17c3R5bGVzLnNjb3JlRGlzcGxheX0+XG4gICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgY2xhc3M9e3N0eWxlcy5ncmFkZX0gXG4gICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6IGdyYWRlQ29sb3IoKSB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2dyYWRlKCl9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPXtzdHlsZXMuc2NvcmV9PlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPXtzdHlsZXMuc2NvcmVWYWx1ZX0+e01hdGgucm91bmQocHJvcHMub3ZlcmFsbFNjb3JlKX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e3N0eWxlcy5zY29yZUxhYmVsfT4vIDEwMDwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPHAgY2xhc3M9e3N0eWxlcy5mZWVkYmFja30+e2dldEZlZWRiYWNrKHByb3BzLm92ZXJhbGxTY29yZSl9PC9wPlxuICAgICAgICAgIDwvQ2FyZD5cblxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmxpbmVSZXN1bHRzLmxlbmd0aCA+IDB9PlxuICAgICAgICAgICAgPENhcmQgY2xhc3M9e3N0eWxlcy5kZXRhaWxzQ2FyZH0+XG4gICAgICAgICAgICAgIDxoMyBjbGFzcz17c3R5bGVzLmRldGFpbHNUaXRsZX0+TGluZSBQZXJmb3JtYW5jZTwvaDM+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9e3N0eWxlcy5saW5lUmVzdWx0c30+XG4gICAgICAgICAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5saW5lUmVzdWx0c30+XG4gICAgICAgICAgICAgICAgICB7KGxpbmUpID0+IChcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz17c3R5bGVzLmxpbmVSZXN1bHR9PlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9e3N0eWxlcy5saW5lVGV4dH0+e2xpbmUudGV4dH08L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPXtzdHlsZXMubGluZVNjb3JlfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxQcm9ncmVzc0JhciBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2xpbmUuc2NvcmV9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICBtYXg9ezEwMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9e3N0eWxlcy5saW5lUHJvZ3Jlc3N9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e3N0eWxlcy5saW5lU2NvcmVWYWx1ZX0+e2xpbmUuc2NvcmV9JTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDwvRm9yPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvQ2FyZD5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICA8ZGl2IGNsYXNzPXtzdHlsZXMuYWN0aW9uc30+XG4gICAgICAgICAgICA8QnV0dG9uIFxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiIFxuICAgICAgICAgICAgICBzaXplPVwibGFyZ2VcIlxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblRyeUFnYWlufVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBUcnkgQWdhaW5cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8Lz5cbiAgICAgIH0+XG4gICAgICAgIDxkaXYgY2xhc3M9e3N0eWxlcy5hbmFseXppbmd9PlxuICAgICAgICAgIDxkaXYgY2xhc3M9e3N0eWxlcy5zcGlubmVyfSAvPlxuICAgICAgICAgIDxoMj5BbmFseXppbmcgUGVyZm9ybWFuY2UuLi48L2gyPlxuICAgICAgICAgIDxwPlByb2Nlc3NpbmcgeW91ciB2b2NhbHMgYW5kIGNhbGN1bGF0aW5nIHNjb3JlczwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZUVmZmVjdCwgY3JlYXRlU2lnbmFsLCBvbk1vdW50LCBvbkNsZWFudXAsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNyZWF0ZUthcmFva2VBdWRpb1Byb2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvcic7XG5pbXBvcnQgeyBjcmVhdGVLYXJhb2tlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9zdG9yZXMva2FyYW9rZVN0b3JlJztcbmltcG9ydCB7IEthcmFva2VBcGlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpJztcbmltcG9ydCB7IHNob3VsZENodW5rTGluZXMsIGNhbGN1bGF0ZVJlY29yZGluZ0R1cmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMva2FyYW9rZS9jaHVua2luZ1V0aWxzJztcbmltcG9ydCB7IEx5cmljc0Rpc3BsYXkgfSBmcm9tICcuLi9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB7IEthcmFva2VDb21wbGV0aW9uIH0gZnJvbSAnLi4vS2FyYW9rZUNvbXBsZXRpb24nO1xuaW1wb3J0IHR5cGUgeyBLYXJhb2tlRGF0YSwgU2Vzc2lvblJlc3VsdHMgfSBmcm9tICcuLi8uLi8uLi90eXBlcy9rYXJhb2tlJztcblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlU2Vzc2lvblByb3BzIHtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0cmFja1RpdGxlPzogc3RyaW5nO1xuICBhcnRpc3Q/OiBzdHJpbmc7XG4gIGF1dGhUb2tlbj86IHN0cmluZztcbiAgb25Db21wbGV0ZT86IChyZXN1bHRzOiBTZXNzaW9uUmVzdWx0cykgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IEthcmFva2VTZXNzaW9uOiBDb21wb25lbnQ8S2FyYW9rZVNlc3Npb25Qcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgYXVkaW9Qcm9jZXNzb3IgPSBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3IoKTtcbiAgY29uc3Qgc3RvcmUgPSBjcmVhdGVLYXJhb2tlU3RvcmUoKTtcbiAgY29uc3Qga2FyYW9rZUFwaSA9IG5ldyBLYXJhb2tlQXBpU2VydmljZSgpO1xuICBcbiAgY29uc3QgW2N1cnJlbnRBdWRpb1RpbWUsIHNldEN1cnJlbnRBdWRpb1RpbWVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbaXNBdWRpb1BsYXlpbmcsIHNldElzQXVkaW9QbGF5aW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjb3VudGRvd25TZWNvbmRzLCBzZXRDb3VudGRvd25TZWNvbmRzXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCB1bmRlZmluZWQ+KCk7XG4gIGNvbnN0IFtzaG93Q29tcGxldGlvbiwgc2V0U2hvd0NvbXBsZXRpb25dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzQW5hbHl6aW5nLCBzZXRJc0FuYWx5emluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2Vzc2lvblJlc3VsdHMsIHNldFNlc3Npb25SZXN1bHRzXSA9IGNyZWF0ZVNpZ25hbDxTZXNzaW9uUmVzdWx0cyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbdXNlckJlc3RTY29yZSwgc2V0VXNlckJlc3RTY29yZV0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgdW5kZWZpbmVkPigpO1xuICBjb25zdCBbaXNOZXdCZXN0U2NvcmUsIHNldElzTmV3QmVzdFNjb3JlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFttZXNzYWdlLCBzZXRNZXNzYWdlXSA9IGNyZWF0ZVNpZ25hbCgnJyk7XG4gIFxuICBjb25zdCBnZXRBdWRpb0VsZW1lbnQgPSAoKTogSFRNTEF1ZGlvRWxlbWVudCB8IG51bGwgPT4ge1xuICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdHJhY2snKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGNvbm5lY3RUb1NlcnZlciA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoc3RvcmUuY29ubmVjdGlvblN0YXR1cygpID09PSAnY29ubmVjdGluZycgfHwgc3RvcmUuY29ubmVjdGlvblN0YXR1cygpID09PSAnY29ubmVjdGVkJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBzdG9yZS5zZXRDb25uZWN0aW9uU3RhdHVzKCdjb25uZWN0aW5nJyk7XG4gICAgc2V0TWVzc2FnZSgnJyk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBrYXJhb2tlQXBpLmZldGNoS2FyYW9rZURhdGEocHJvcHMudHJhY2tJZCwgcHJvcHMudHJhY2tUaXRsZSwgcHJvcHMuYXJ0aXN0KTtcbiAgICAgIFxuICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgc3RvcmUuc2V0S2FyYW9rZURhdGEoZGF0YSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGF0YS5oYXNfa2FyYW9rZSAmJiBkYXRhLnNvbmcgJiYgZGF0YS5seXJpY3M/LnR5cGUgPT09ICdzeW5jZWQnKSB7XG4gICAgICAgICAgY29uc3QgaGFzVGltZWRMeXJpY3MgPSBkYXRhLmx5cmljcy5saW5lcy5zb21lKGxpbmUgPT4gbGluZS50aW1lc3RhbXAgIT09IG51bGwpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChoYXNUaW1lZEx5cmljcykge1xuICAgICAgICAgICAgc3RvcmUuc2V0Q29ubmVjdGlvblN0YXR1cygnY29ubmVjdGVkJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBLYXJhb2tlIGRhdGEgbG9hZGVkOicsIGRhdGEpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoZGF0YS5zb25nLmdlbml1c19pZCAmJiBwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgICAgICAgY29uc3QgYmVzdFNjb3JlID0gYXdhaXQga2FyYW9rZUFwaS5nZXRVc2VyQmVzdFNjb3JlKGRhdGEuc29uZy5nZW5pdXNfaWQsIHByb3BzLmF1dGhUb2tlbik7XG4gICAgICAgICAgICAgIGlmIChiZXN0U2NvcmUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBzZXRVc2VyQmVzdFNjb3JlKGJlc3RTY29yZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RvcmUuc2V0Q29ubmVjdGlvblN0YXR1cygnbm8ta2FyYW9rZScpO1xuICAgICAgICAgICAgc2V0TWVzc2FnZSgnVGhpcyB0cmFjayBoYXMgbHlyaWNzIGJ1dCBubyBzeW5jaHJvbml6ZWQgdGltaW5nIGZvciBrYXJhb2tlLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdG9yZS5zZXRDb25uZWN0aW9uU3RhdHVzKCduby1rYXJhb2tlJyk7XG4gICAgICAgICAgc2V0TWVzc2FnZSgnTm8ga2FyYW9rZSBhdmFpbGFibGUgZm9yIHRoaXMgdHJhY2suJyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YScpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjb25uZWN0OicsIGVycm9yKTtcbiAgICAgIHN0b3JlLnNldENvbm5lY3Rpb25TdGF0dXMoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgICAgc2V0TWVzc2FnZSgnRmFpbGVkIHRvIGNvbm5lY3QgdG8gc2VydmVyJyk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgaGFuZGxlU3RhcnRLYXJhb2tlID0gKCkgPT4ge1xuICAgIHNldENvdW50ZG93blNlY29uZHMoMyk7XG4gICAgXG4gICAgbGV0IGNvdW50ID0gMztcbiAgICBjb25zdCBjb3VudGRvd25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGNvdW50LS07XG4gICAgICBcbiAgICAgIGlmIChjb3VudCA8PSAwKSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwoY291bnRkb3duSW50ZXJ2YWwpO1xuICAgICAgICBzZXRDb3VudGRvd25TZWNvbmRzKHVuZGVmaW5lZCk7XG4gICAgICAgIHN0b3JlLnNldElzS2FyYW9rZUFjdGl2ZSh0cnVlKTtcbiAgICAgICAgc3RhcnRLYXJhb2tlU2Vzc2lvbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0Q291bnRkb3duU2Vjb25kcyhjb3VudCk7XG4gICAgICB9XG4gICAgfSwgMTAwMCk7XG4gIH07XG4gIFxuICBjb25zdCBzdGFydEthcmFva2VTZXNzaW9uID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBzdG9yZS5rYXJhb2tlRGF0YSgpO1xuICAgIGlmICghZGF0YSB8fCAhZGF0YS5zb25nIHx8ICFwcm9wcy5hdXRoVG9rZW4pIHJldHVybjtcbiAgICBcbiAgICBpZiAoIWF1ZGlvUHJvY2Vzc29yLmlzUmVhZHkoKSkge1xuICAgICAgYXdhaXQgYXVkaW9Qcm9jZXNzb3IuaW5pdGlhbGl6ZSgpO1xuICAgIH1cbiAgICBcbiAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydEZ1bGxTZXNzaW9uKCk7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gU3RhcnRlZCBmdWxsIHNlc3Npb24gcmVjb3JkaW5nJyk7XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBnZXRBdWRpb0VsZW1lbnQoKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGthcmFva2VBcGkuc3RhcnRTZXNzaW9uKFxuICAgICAgICBwcm9wcy50cmFja0lkLFxuICAgICAgICB7XG4gICAgICAgICAgdGl0bGU6IGRhdGEuc29uZy50aXRsZSxcbiAgICAgICAgICBhcnRpc3Q6IGRhdGEuc29uZy5hcnRpc3QsXG4gICAgICAgICAgZ2VuaXVzX2lkOiBkYXRhLnNvbmcuZ2VuaXVzX2lkLFxuICAgICAgICB9LFxuICAgICAgICBwcm9wcy5hdXRoVG9rZW5cbiAgICAgICk7XG4gICAgICBcbiAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgIHN0b3JlLnNldEN1cnJlbnRTZXNzaW9uKHNlc3Npb24pO1xuICAgICAgICBzdG9yZS5yZXNldFNjb3JpbmcoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChhdWRpbyAmJiBkYXRhLnNvbmcuc3RhcnRfdGltZSkge1xuICAgICAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gZGF0YS5zb25nLnN0YXJ0X3RpbWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChhdWRpbyAmJiBhdWRpby5wYXVzZWQpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgYXVkaW8ucGxheSgpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEVycm9yIGF1dG8tcGxheWluZyBhdWRpbzonLCBlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTZXNzaW9uIHN0YXJ0ZWQ6Jywgc2Vzc2lvbik7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRXJyb3Igc3RhcnRpbmcgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICBzZXRNZXNzYWdlKCdGYWlsZWQgdG8gc3RhcnQga2FyYW9rZS4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcbiAgICAgIHN0b3JlLnNldElzS2FyYW9rZUFjdGl2ZShmYWxzZSk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgaGFuZGxlU3RhcnRSZWNvcmRpbmcgPSBhc3luYyAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICBpZiAoc3RvcmUuaXNSZWNvcmRpbmcoKSB8fCAhYXVkaW9Qcm9jZXNzb3IuaXNSZWFkeSgpIHx8ICFwcm9wcy5hdXRoVG9rZW4pIHJldHVybjtcbiAgICBcbiAgICBzdG9yZS5zZXRDdXJyZW50UmVjb3JkaW5nTGluZShsaW5lSW5kZXgpO1xuICAgIHN0b3JlLnNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gc3RvcmUua2FyYW9rZURhdGEoKTtcbiAgICAgIGNvbnN0IGxpbmVzID0gZGF0YT8ubHlyaWNzPy5saW5lcyB8fCBbXTtcbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tsaW5lSW5kZXhdO1xuICAgICAgXG4gICAgICBjb25zdCBjaHVua0luZm8gPSBzaG91bGRDaHVua0xpbmVzKGxpbmVzLCBsaW5lSW5kZXgpO1xuICAgICAgY29uc3QgaXNDaHVua2VkID0gY2h1bmtJbmZvLmVuZEluZGV4ID4gbGluZUluZGV4O1xuICAgICAgXG4gICAgICBpZiAoaXNDaHVua2VkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbS2FyYW9rZVNlc3Npb25dIENodW5raW5nIGxpbmVzICR7bGluZUluZGV4fS0ke2NodW5rSW5mby5lbmRJbmRleH0gKCR7Y2h1bmtJbmZvLndvcmRDb3VudH0gd29yZHMpYFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBsaW5lRHVyYXRpb24gPSBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbihsaW5lcywgY2h1bmtJbmZvKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICdbS2FyYW9rZVNlc3Npb25dIFN0YXJ0aW5nIHJlY29yZGluZyBmb3IgbGluZTonLFxuICAgICAgICBsaW5lSW5kZXgsXG4gICAgICAgICdEdXJhdGlvbjonLFxuICAgICAgICBsaW5lRHVyYXRpb24gKyAnbXMnXG4gICAgICApO1xuICAgICAgXG4gICAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydFJlY29yZGluZ0xpbmUobGluZUluZGV4KTtcbiAgICAgIFxuICAgICAgaWYgKCFhdWRpb1Byb2Nlc3Nvci5pc0xpc3RlbmluZygpKSB7XG4gICAgICAgIGF1ZGlvUHJvY2Vzc29yLnN0YXJ0TGlzdGVuaW5nKCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBBdXRvLXN0b3BwaW5nIHJlY29yZGluZyBmb3IgbGluZTonLCBsaW5lSW5kZXgpO1xuICAgICAgICBjb25zdCBhdWRpb0NodW5rcyA9IGF1ZGlvUHJvY2Vzc29yLnN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8oKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChhdWRpb0NodW5rcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3Qgd2F2QmxvYiA9IGF1ZGlvUHJvY2Vzc29yLmNvbnZlcnRBdWRpb1RvV2F2QmxvYihhdWRpb0NodW5rcyk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHdhdkJsb2IpIHtcbiAgICAgICAgICAgIGNvbnN0IGFycmF5QnVmZmVyID0gYXdhaXQgd2F2QmxvYi5hcnJheUJ1ZmZlcigpO1xuICAgICAgICAgICAgY29uc3QgdWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5QnVmZmVyKTtcbiAgICAgICAgICAgIGxldCBiaW5hcnlTdHJpbmcgPSAnJztcbiAgICAgICAgICAgIGNvbnN0IGNodW5rU2l6ZSA9IDEwMjQ7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVpbnQ4QXJyYXkubGVuZ3RoOyBpICs9IGNodW5rU2l6ZSkge1xuICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IHVpbnQ4QXJyYXkuc2xpY2UoaSwgaSArIGNodW5rU2l6ZSk7XG4gICAgICAgICAgICAgIGJpbmFyeVN0cmluZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKC4uLmNodW5rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGJ0b2EoYmluYXJ5U3RyaW5nKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgc3VibWl0UmVjb3JkaW5nKFxuICAgICAgICAgICAgICBsaW5lSW5kZXgsXG4gICAgICAgICAgICAgIGF1ZGlvRGF0YSxcbiAgICAgICAgICAgICAgaXNDaHVua2VkID8gY2h1bmtJbmZvLmV4cGVjdGVkVGV4dCA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGlzQ2h1bmtlZCkge1xuICAgICAgICAgICAgICBmb3IgKGxldCBpID0gbGluZUluZGV4ICsgMTsgaSA8PSBjaHVua0luZm8uZW5kSW5kZXg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1haW5TY29yZSA9IHN0b3JlLmxpbmVTY29yZXMoKS5nZXQobGluZUluZGV4KTtcbiAgICAgICAgICAgICAgICBpZiAobWFpblNjb3JlKSB7XG4gICAgICAgICAgICAgICAgICBzdG9yZS51cGRhdGVMaW5lU2NvcmUoaSwgbWFpblNjb3JlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHN0b3JlLnNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICAgICAgc3RvcmUuc2V0Q3VycmVudFJlY29yZGluZ0xpbmUodW5kZWZpbmVkKTtcbiAgICAgIH0sIGxpbmVEdXJhdGlvbiArIDUwMCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gUmVjb3JkaW5nIGZhaWxlZDonLCBlcnJvcik7XG4gICAgICBzdG9yZS5zZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3VibWl0UmVjb3JkaW5nID0gYXN5bmMgKFxuICAgIGxpbmVJbmRleDogbnVtYmVyLFxuICAgIGF1ZGlvRGF0YTogc3RyaW5nLFxuICAgIGNodW5rZWRUZXh0Pzogc3RyaW5nXG4gICkgPT4ge1xuICAgIGNvbnN0IHNlc3Npb24gPSBzdG9yZS5jdXJyZW50U2Vzc2lvbigpO1xuICAgIGNvbnN0IGRhdGEgPSBzdG9yZS5rYXJhb2tlRGF0YSgpO1xuICAgIGlmICghc2Vzc2lvbiB8fCAhZGF0YT8ubHlyaWNzPy5saW5lc1tsaW5lSW5kZXhdIHx8ICFwcm9wcy5hdXRoVG9rZW4pIHJldHVybjtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2NvcmUgPSBhd2FpdCBrYXJhb2tlQXBpLmdyYWRlUmVjb3JkaW5nKFxuICAgICAgICBzZXNzaW9uLnNlc3Npb25faWQsXG4gICAgICAgIGxpbmVJbmRleCxcbiAgICAgICAgYXVkaW9EYXRhLFxuICAgICAgICBjaHVua2VkVGV4dCB8fCBkYXRhLmx5cmljcy5saW5lc1tsaW5lSW5kZXhdLnRleHQsXG4gICAgICAgIChzdG9yZS5saW5lU2NvcmVzKCkuZ2V0KGxpbmVJbmRleCk/LmF0dGVtcHRzIHx8IDApICsgMSxcbiAgICAgICAgcHJvcHMuYXV0aFRva2VuXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAoc2NvcmUpIHtcbiAgICAgICAgc3RvcmUudXBkYXRlTGluZVNjb3JlKGxpbmVJbmRleCwgc2NvcmUpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBMaW5lIHNjb3JlZDonLCBzY29yZSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIHN1Ym1pdCByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IHRyaWdnZXJTZXNzaW9uQ29tcGxldGlvbiA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBDb21wbGV0aW5nIHNlc3Npb24uLi4nKTtcbiAgICBcbiAgICBjb25zdCBhdWRpbyA9IGdldEF1ZGlvRWxlbWVudCgpO1xuICAgIGlmIChhdWRpbykge1xuICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICB9XG4gICAgXG4gICAgc3RvcmUuc2V0SXNLYXJhb2tlQWN0aXZlKGZhbHNlKTtcbiAgICBcbiAgICBjb25zdCBzZXNzaW9uV2F2ID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2KCk7XG4gICAgaWYgKCFzZXNzaW9uV2F2IHx8ICFwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gTm8gc2Vzc2lvbiBhdWRpbyBvciBhdXRoIHRva2VuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHNldElzQW5hbHl6aW5nKHRydWUpO1xuICAgIHNldFNob3dDb21wbGV0aW9uKHRydWUpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgY29uc3QgYXVkaW9CYXNlNjQgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBiYXNlNjQgPSByZWFkZXIucmVzdWx0IGFzIHN0cmluZztcbiAgICAgICAgICByZXNvbHZlKGJhc2U2NC5zcGxpdCgnLCcpWzFdKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLm9uZXJyb3IgPSByZWplY3Q7XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKHNlc3Npb25XYXYpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGRhdGEgPSBzdG9yZS5rYXJhb2tlRGF0YSgpO1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IHN0b3JlLmN1cnJlbnRTZXNzaW9uKCk7XG4gICAgICBcbiAgICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIE5vIGFjdGl2ZSBzZXNzaW9uJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IGthcmFva2VBcGkuY29tcGxldGVTZXNzaW9uKFxuICAgICAgICBzZXNzaW9uLnNlc3Npb25faWQsXG4gICAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgICBkYXRhPy5seXJpY3M/LmxpbmVzIHx8IFtdLFxuICAgICAgICBwcm9wcy5hdXRoVG9rZW5cbiAgICAgICk7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHRzKSB7XG4gICAgICAgIHNldFNlc3Npb25SZXN1bHRzKHJlc3VsdHMpO1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2Vzc2lvblNjb3JlID0gc3RvcmUudG90YWxTY29yZSgpO1xuICAgICAgICBjb25zdCBjdXJyZW50QmVzdFNjb3JlID0gdXNlckJlc3RTY29yZSgpIHx8IDA7XG4gICAgICAgIFxuICAgICAgICBpZiAoc2Vzc2lvblNjb3JlID4gY3VycmVudEJlc3RTY29yZSkge1xuICAgICAgICAgIHNldFVzZXJCZXN0U2NvcmUoc2Vzc2lvblNjb3JlKTtcbiAgICAgICAgICBzZXRJc05ld0Jlc3RTY29yZSh0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcHJvcHMub25Db21wbGV0ZT8uKHJlc3VsdHMpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEVycm9yIGNvbXBsZXRpbmcgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzQW5hbHl6aW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBoYW5kbGVSZXRyeUthcmFva2UgPSAoKSA9PiB7XG4gICAgc2V0U2hvd0NvbXBsZXRpb24oZmFsc2UpO1xuICAgIHNldFNlc3Npb25SZXN1bHRzKG51bGwpO1xuICAgIHNldElzTmV3QmVzdFNjb3JlKGZhbHNlKTtcbiAgICBzdG9yZS5yZXNldFNjb3JpbmcoKTtcbiAgICBzdG9yZS5zZXRJc0thcmFva2VBY3RpdmUoZmFsc2UpO1xuICAgIGhhbmRsZVN0YXJ0S2FyYW9rZSgpO1xuICB9O1xuICBcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXN0b3JlLmlzS2FyYW9rZUFjdGl2ZSgpIHx8ICFpc0F1ZGlvUGxheWluZygpIHx8IHN0b3JlLmlzUmVjb3JkaW5nKCkpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBkYXRhID0gc3RvcmUua2FyYW9rZURhdGEoKTtcbiAgICBpZiAoIWRhdGE/Lmx5cmljcz8ubGluZXMpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBjdXJyZW50VGltZSA9IGN1cnJlbnRBdWRpb1RpbWUoKTtcbiAgICBjb25zdCBjdXJyZW50UmVjb3JkaW5nID0gc3RvcmUuY3VycmVudFJlY29yZGluZ0xpbmUoKTtcbiAgICBcbiAgICBsZXQgbGluZVRvUmVjb3JkOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gICAgXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmx5cmljcy5saW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IGRhdGEubHlyaWNzLmxpbmVzW2ldO1xuICAgICAgXG4gICAgICBjb25zdCByZWNvcmRpbmdTdGFydCA9IGxpbmUucmVjb3JkaW5nU3RhcnQgfHwgbGluZS50aW1lc3RhbXAgLSAzMDA7XG4gICAgICBjb25zdCByZWNvcmRpbmdFbmQgPSBsaW5lLnJlY29yZGluZ0VuZCB8fCBcbiAgICAgICAgKGRhdGEubHlyaWNzLmxpbmVzW2kgKyAxXT8udGltZXN0YW1wIC0gMjAwKSB8fFxuICAgICAgICAobGluZS50aW1lc3RhbXAgKyBNYXRoLm1pbihsaW5lLmR1cmF0aW9uIHx8IDMwMDAsIDUwMDApKTtcbiAgICAgIFxuICAgICAgaWYgKGN1cnJlbnRUaW1lID49IHJlY29yZGluZ1N0YXJ0ICYmIGN1cnJlbnRUaW1lIDwgcmVjb3JkaW5nRW5kKSB7XG4gICAgICAgIGxpbmVUb1JlY29yZCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoXG4gICAgICBsaW5lVG9SZWNvcmQgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgY3VycmVudFJlY29yZGluZyAhPT0gbGluZVRvUmVjb3JkICYmXG4gICAgICAhc3RvcmUubGluZVNjb3JlcygpLmhhcyhsaW5lVG9SZWNvcmQpXG4gICAgKSB7XG4gICAgICBoYW5kbGVTdGFydFJlY29yZGluZyhsaW5lVG9SZWNvcmQpO1xuICAgIH1cbiAgfSk7XG4gIFxuICBvbk1vdW50KGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBjb25uZWN0VG9TZXJ2ZXIoKTtcbiAgICBcbiAgICBjb25zdCBhdWRpbyA9IGdldEF1ZGlvRWxlbWVudCgpO1xuICAgIGlmICghYXVkaW8pIHJldHVybjtcbiAgICBcbiAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgc2V0Q3VycmVudEF1ZGlvVGltZShhdWRpby5jdXJyZW50VGltZSAqIDEwMDApO1xuICAgICAgc2V0SXNBdWRpb1BsYXlpbmcoIWF1ZGlvLnBhdXNlZCk7XG4gICAgfTtcbiAgICBcbiAgICBjb25zdCBoYW5kbGVUaW1lVXBkYXRlID0gKCkgPT4gdXBkYXRlVGltZSgpO1xuICAgIGNvbnN0IGhhbmRsZVBsYXkgPSAoKSA9PiBzZXRJc0F1ZGlvUGxheWluZyh0cnVlKTtcbiAgICBjb25zdCBoYW5kbGVQYXVzZSA9ICgpID0+IHNldElzQXVkaW9QbGF5aW5nKGZhbHNlKTtcbiAgICBjb25zdCBoYW5kbGVFbmRlZCA9ICgpID0+IHtcbiAgICAgIGlmIChzdG9yZS5pc0thcmFva2VBY3RpdmUoKSkge1xuICAgICAgICB0cmlnZ2VyU2Vzc2lvbkNvbXBsZXRpb24oKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCBoYW5kbGVUaW1lVXBkYXRlKTtcbiAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdwbGF5JywgaGFuZGxlUGxheSk7XG4gICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcigncGF1c2UnLCBoYW5kbGVQYXVzZSk7XG4gICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBoYW5kbGVFbmRlZCk7XG4gICAgXG4gICAgdXBkYXRlVGltZSgpO1xuICAgIFxuICAgIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgaGFuZGxlVGltZVVwZGF0ZSk7XG4gICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdwbGF5JywgaGFuZGxlUGxheSk7XG4gICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdwYXVzZScsIGhhbmRsZVBhdXNlKTtcbiAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgaGFuZGxlRW5kZWQpO1xuICAgIH0pO1xuICB9KTtcbiAgXG4gIHJldHVybiAoXG4gICAgPFNob3dcbiAgICAgIHdoZW49eyFzaG93Q29tcGxldGlvbigpfVxuICAgICAgZmFsbGJhY2s9e1xuICAgICAgICA8S2FyYW9rZUNvbXBsZXRpb25cbiAgICAgICAgICBvdmVyYWxsU2NvcmU9e3Nlc3Npb25SZXN1bHRzKCk/Lm92ZXJhbGxTY29yZSB8fCBzdG9yZS50b3RhbFNjb3JlKCl9XG4gICAgICAgICAgc29uZz17e1xuICAgICAgICAgICAgdGl0bGU6IHN0b3JlLmthcmFva2VEYXRhKCk/LnNvbmc/LnRpdGxlIHx8IHByb3BzLnRyYWNrVGl0bGUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgYXJ0aXN0OiBzdG9yZS5rYXJhb2tlRGF0YSgpPy5zb25nPy5hcnRpc3QgfHwgcHJvcHMuYXJ0aXN0IHx8ICdVbmtub3duJyxcbiAgICAgICAgICB9fVxuICAgICAgICAgIGxpbmVSZXN1bHRzPXtzZXNzaW9uUmVzdWx0cygpPy5saW5lUmVzdWx0cyB8fCBbXX1cbiAgICAgICAgICBpc0FuYWx5emluZz17aXNBbmFseXppbmcoKX1cbiAgICAgICAgICBpc05ld0Jlc3RTY29yZT17aXNOZXdCZXN0U2NvcmUoKX1cbiAgICAgICAgICBvblRyeUFnYWluPXtoYW5kbGVSZXRyeUthcmFva2V9XG4gICAgICAgIC8+XG4gICAgICB9XG4gICAgPlxuICAgICAgPEx5cmljc0Rpc3BsYXlcbiAgICAgICAgbHlyaWNzPXtzdG9yZS5rYXJhb2tlRGF0YSgpPy5seXJpY3M/LmxpbmVzLm1hcChsaW5lID0+ICh7XG4gICAgICAgICAgdGV4dDogbGluZS50ZXh0LFxuICAgICAgICAgIHN0YXJ0VGltZTogbGluZS50aW1lc3RhbXAsXG4gICAgICAgICAgZHVyYXRpb246IGxpbmUuZHVyYXRpb24sXG4gICAgICAgIH0pKSB8fCBbXX1cbiAgICAgICAgY3VycmVudFRpbWU9e2N1cnJlbnRBdWRpb1RpbWUoKX1cbiAgICAgICAgaXNQbGF5aW5nPXtpc0F1ZGlvUGxheWluZygpfVxuICAgICAgICBjdXJyZW50UmVjb3JkaW5nTGluZT17c3RvcmUuY3VycmVudFJlY29yZGluZ0xpbmUoKX1cbiAgICAgICAgaXNSZWNvcmRpbmc9e3N0b3JlLmlzUmVjb3JkaW5nKCl9XG4gICAgICAgIGxpbmVTY29yZXM9e3N0b3JlLmxpbmVTY29yZXMoKX1cbiAgICAgICAgcGVyZm9ybWFuY2VTdGF0ZT17c3RvcmUucGVyZm9ybWFuY2VTdGF0ZSgpfVxuICAgICAgICBwZXJmb3JtYW5jZVNjb3JlPXtzdG9yZS5wZXJmb3JtYW5jZVNjb3JlKCl9XG4gICAgICAgIGNvbm5lY3Rpb25TdGF0dXM9e3N0b3JlLmNvbm5lY3Rpb25TdGF0dXMoKX1cbiAgICAgICAgaXNLYXJhb2tlQWN0aXZlPXtzdG9yZS5pc0thcmFva2VBY3RpdmUoKX1cbiAgICAgICAgb25TdGFydEthcmFva2U9e2hhbmRsZVN0YXJ0S2FyYW9rZX1cbiAgICAgICAgb25SZXRyeUNvbm5lY3Rpb249e2Nvbm5lY3RUb1NlcnZlcn1cbiAgICAgICAgc3RhdHVzTWVzc2FnZT17bWVzc2FnZSgpfVxuICAgICAgICBjb3VudGRvd25TZWNvbmRzPXtjb3VudGRvd25TZWNvbmRzKCl9XG4gICAgICAgIGRpZmZpY3VsdHk9e3N0b3JlLmthcmFva2VEYXRhKCk/LnNvbmc/LmRpZmZpY3VsdHl9XG4gICAgICAgIGJlc3RTY29yZT17dXNlckJlc3RTY29yZSgpfVxuICAgICAgICBzb25nSWQ9e3N0b3JlLmthcmFva2VEYXRhKCk/LnNvbmc/Lmdlbml1c19pZCB8fCBzdG9yZS5rYXJhb2tlRGF0YSgpPy50cmFja19pZH1cbiAgICAgIC8+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgSWNvblhSZWd1bGFyIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25YUmVndWxhcic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBQcmFjdGljZUhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIG9uRXhpdDogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZUhlYWRlcjogQ29tcG9uZW50PFByYWN0aWNlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGhlYWRlciBjbGFzcz17Y24oJ2ZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE0IHB4LTQgYmctdHJhbnNwYXJlbnQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkV4aXR9XG4gICAgICAgIGNsYXNzPVwicC0yIC1tbC0yIHJvdW5kZWQtZnVsbCBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPVwiRXhpdCBwcmFjdGljZVwiXG4gICAgICA+XG4gICAgICAgIDxJY29uWFJlZ3VsYXIgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeSB3LTYgaC02XCIgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgIDxoMSBjbGFzcz1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXByaW1hcnkgYWJzb2x1dGUgbGVmdC0xLzIgdHJhbnNmb3JtIC10cmFuc2xhdGUteC0xLzJcIj5cbiAgICAgICAgICB7cHJvcHMudGl0bGV9XG4gICAgICAgIDwvaDE+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBTcGFjZXIgdG8gYmFsYW5jZSB0aGUgbGF5b3V0ICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctMTBcIiAvPlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJleHBvcnQgaW50ZXJmYWNlIFRyYWNrSW5mbyB7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIHBsYXRmb3JtOiAnc291bmRjbG91ZCc7XG4gIHVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVHJhY2tEZXRlY3RvciB7XG4gIC8qKlxuICAgKiBEZXRlY3QgY3VycmVudCB0cmFjayBmcm9tIHRoZSBwYWdlIChTb3VuZENsb3VkIG9ubHkpXG4gICAqL1xuICBkZXRlY3RDdXJyZW50VHJhY2soKTogVHJhY2tJbmZvIHwgbnVsbCB7XG4gICAgY29uc3QgdXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgXG4gICAgLy8gT25seSB3b3JrIG9uIHNjLm1haWQuem9uZSAoU291bmRDbG91ZCBwcm94eSlcbiAgICBpZiAodXJsLmluY2x1ZGVzKCdzYy5tYWlkLnpvbmUnKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZGV0ZWN0U291bmRDbG91ZFRyYWNrKCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICAvKipcbiAgICogRXh0cmFjdCB0cmFjayBpbmZvIGZyb20gU291bmRDbG91ZCAoc2MubWFpZC56b25lKVxuICAgKi9cbiAgcHJpdmF0ZSBkZXRlY3RTb3VuZENsb3VkVHJhY2soKTogVHJhY2tJbmZvIHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFNvdW5kQ2xvdWQgVVJMczogc2MubWFpZC56b25lL3VzZXIvdHJhY2stbmFtZVxuICAgICAgY29uc3QgcGF0aFBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgaWYgKHBhdGhQYXJ0cy5sZW5ndGggPCAyKSByZXR1cm4gbnVsbDtcblxuICAgICAgY29uc3QgYXJ0aXN0ID0gcGF0aFBhcnRzWzBdO1xuICAgICAgY29uc3QgdHJhY2tTbHVnID0gcGF0aFBhcnRzWzFdO1xuICAgICAgXG4gICAgICAvLyBUcnkgdG8gZ2V0IGFjdHVhbCB0aXRsZSBmcm9tIHBhZ2UgKFNvdW5kQ2xvdWQgc2VsZWN0b3JzKVxuICAgICAgY29uc3QgdGl0bGVTZWxlY3RvcnMgPSBbXG4gICAgICAgICcuc291bmRUaXRsZV9fdGl0bGUnLFxuICAgICAgICAnLnRyYWNrSXRlbV9fdHJhY2tUaXRsZScsIFxuICAgICAgICAnaDFbaXRlbXByb3A9XCJuYW1lXCJdJyxcbiAgICAgICAgJy5zb3VuZF9faGVhZGVyIGgxJyxcbiAgICAgICAgJy5zYy10ZXh0LWg0JyxcbiAgICAgICAgJy5zYy10ZXh0LXByaW1hcnknXG4gICAgICBdO1xuXG4gICAgICBsZXQgdGl0bGUgPSAnJztcbiAgICAgIGZvciAoY29uc3Qgc2VsZWN0b3Igb2YgdGl0bGVTZWxlY3RvcnMpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgICAgICBpZiAoZWxlbWVudCAmJiBlbGVtZW50LnRleHRDb250ZW50KSB7XG4gICAgICAgICAgdGl0bGUgPSBlbGVtZW50LnRleHRDb250ZW50LnRyaW0oKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBGYWxsYmFjayB0byBzbHVnXG4gICAgICBpZiAoIXRpdGxlKSB7XG4gICAgICAgIHRpdGxlID0gdHJhY2tTbHVnLnJlcGxhY2UoLy0vZywgJyAnKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2xlYW4gdXAgYXJ0aXN0IG5hbWVcbiAgICAgIGNvbnN0IGNsZWFuQXJ0aXN0ID0gYXJ0aXN0LnJlcGxhY2UoLy0vZywgJyAnKS5yZXBsYWNlKC9fL2csICcgJyk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRyYWNrSWQ6IGAke2FydGlzdH0vJHt0cmFja1NsdWd9YCxcbiAgICAgICAgdGl0bGU6IHRpdGxlLFxuICAgICAgICBhcnRpc3Q6IGNsZWFuQXJ0aXN0LFxuICAgICAgICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnLFxuICAgICAgICB1cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1RyYWNrRGV0ZWN0b3JdIEVycm9yIGRldGVjdGluZyBTb3VuZENsb3VkIHRyYWNrOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBwYWdlIGNoYW5nZXMgKFNvdW5kQ2xvdWQgaXMgYSBTUEEpXG4gICAqL1xuICB3YXRjaEZvckNoYW5nZXMoY2FsbGJhY2s6ICh0cmFjazogVHJhY2tJbmZvIHwgbnVsbCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xuICAgIGxldCBjdXJyZW50VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgbGV0IGN1cnJlbnRUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgXG4gICAgLy8gSW5pdGlhbCBkZXRlY3Rpb25cbiAgICBjYWxsYmFjayhjdXJyZW50VHJhY2spO1xuXG4gICAgLy8gV2F0Y2ggZm9yIFVSTCBjaGFuZ2VzXG4gICAgY29uc3QgY2hlY2tGb3JDaGFuZ2VzID0gKCkgPT4ge1xuICAgICAgY29uc3QgbmV3VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgICBpZiAobmV3VXJsICE9PSBjdXJyZW50VXJsKSB7XG4gICAgICAgIGN1cnJlbnRVcmwgPSBuZXdVcmw7XG4gICAgICAgIGNvbnN0IG5ld1RyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgdHJpZ2dlciBjYWxsYmFjayBpZiB0cmFjayBhY3R1YWxseSBjaGFuZ2VkXG4gICAgICAgIGNvbnN0IHRyYWNrQ2hhbmdlZCA9ICFjdXJyZW50VHJhY2sgfHwgIW5ld1RyYWNrIHx8IFxuICAgICAgICAgIGN1cnJlbnRUcmFjay50cmFja0lkICE9PSBuZXdUcmFjay50cmFja0lkO1xuICAgICAgICAgIFxuICAgICAgICBpZiAodHJhY2tDaGFuZ2VkKSB7XG4gICAgICAgICAgY3VycmVudFRyYWNrID0gbmV3VHJhY2s7XG4gICAgICAgICAgY2FsbGJhY2sobmV3VHJhY2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFBvbGwgZm9yIGNoYW5nZXMgKFNQQXMgZG9uJ3QgYWx3YXlzIHRyaWdnZXIgcHJvcGVyIG5hdmlnYXRpb24gZXZlbnRzKVxuICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwoY2hlY2tGb3JDaGFuZ2VzLCAxMDAwKTtcblxuICAgIC8vIEFsc28gbGlzdGVuIGZvciBuYXZpZ2F0aW9uIGV2ZW50c1xuICAgIGNvbnN0IGhhbmRsZU5hdmlnYXRpb24gPSAoKSA9PiB7XG4gICAgICBzZXRUaW1lb3V0KGNoZWNrRm9yQ2hhbmdlcywgMTAwKTsgLy8gU21hbGwgZGVsYXkgZm9yIERPTSB1cGRhdGVzXG4gICAgfTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgIFxuICAgIC8vIExpc3RlbiBmb3IgcHVzaHN0YXRlL3JlcGxhY2VzdGF0ZSAoU291bmRDbG91ZCB1c2VzIHRoZXNlKVxuICAgIGNvbnN0IG9yaWdpbmFsUHVzaFN0YXRlID0gaGlzdG9yeS5wdXNoU3RhdGU7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXBsYWNlU3RhdGUgPSBoaXN0b3J5LnJlcGxhY2VTdGF0ZTtcbiAgICBcbiAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUHVzaFN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG4gICAgXG4gICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFJlcGxhY2VTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJuIGNsZWFudXAgZnVuY3Rpb25cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICAgIGhpc3RvcnkucHVzaFN0YXRlID0gb3JpZ2luYWxQdXNoU3RhdGU7XG4gICAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IG9yaWdpbmFsUmVwbGFjZVN0YXRlO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHRyYWNrRGV0ZWN0b3IgPSBuZXcgVHJhY2tEZXRlY3RvcigpOyIsIi8vIFVzaW5nIGJyb3dzZXIuc3RvcmFnZSBBUEkgZGlyZWN0bHkgZm9yIHNpbXBsaWNpdHlcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5cbi8vIEhlbHBlciB0byBnZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEF1dGhUb2tlbigpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnYXV0aFRva2VuJyk7XG4gIHJldHVybiByZXN1bHQuYXV0aFRva2VuIHx8IG51bGw7XG59XG5cbi8vIEhlbHBlciB0byBzZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEF1dGhUb2tlbih0b2tlbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBhdXRoVG9rZW46IHRva2VuIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gZ2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEluc3RhbGxhdGlvblN0YXRlKCk6IFByb21pc2U8e1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGp3dFZlcmlmaWVkOiBib29sZWFuO1xuICB0aW1lc3RhbXA/OiBudW1iZXI7XG59PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoJ2luc3RhbGxhdGlvblN0YXRlJyk7XG4gIHJldHVybiByZXN1bHQuaW5zdGFsbGF0aW9uU3RhdGUgfHwge1xuICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgand0VmVyaWZpZWQ6IGZhbHNlLFxuICB9O1xufVxuXG4vLyBIZWxwZXIgdG8gc2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEluc3RhbGxhdGlvblN0YXRlKHN0YXRlOiB7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGluc3RhbGxhdGlvblN0YXRlOiBzdGF0ZSB9KTtcbn1cblxuLy8gSGVscGVyIHRvIGNoZWNrIGlmIHVzZXIgaXMgYXV0aGVudGljYXRlZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgcmV0dXJuICEhdG9rZW4gJiYgdG9rZW4uc3RhcnRzV2l0aCgnc2NhcmxldHRfJyk7XG59XG5cbi8vIEhlbHBlciB0byBjbGVhciBhdXRoIGRhdGFcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhckF1dGgoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5yZW1vdmUoWydhdXRoVG9rZW4nLCAnaW5zdGFsbGF0aW9uU3RhdGUnXSk7XG59IiwiaW1wb3J0IHsgQ29tcG9uZW50LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgb25Nb3VudCwgb25DbGVhbnVwLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgS2FyYW9rZVNlc3Npb24gfSBmcm9tICdAc2NhcmxldHQvdWknO1xuaW1wb3J0IHsgdHJhY2tEZXRlY3RvciwgdHlwZSBUcmFja0luZm8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvcic7XG5pbXBvcnQgeyBnZXRBdXRoVG9rZW4gfSBmcm9tICcuLi8uLi91dGlscy9zdG9yYWdlJztcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGVudEFwcFByb3BzIHt9XG5cbmV4cG9ydCBjb25zdCBDb250ZW50QXBwOiBDb21wb25lbnQ8Q29udGVudEFwcFByb3BzPiA9ICgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgQ29udGVudEFwcCBjb21wb25lbnQnKTtcbiAgXG4gIC8vIFN0YXRlXG4gIGNvbnN0IFtjdXJyZW50VHJhY2ssIHNldEN1cnJlbnRUcmFja10gPSBjcmVhdGVTaWduYWw8VHJhY2tJbmZvIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFthdXRoVG9rZW4sIHNldEF1dGhUb2tlbl0gPSBjcmVhdGVTaWduYWw8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzTWluaW1pemVkLCBzZXRJc01pbmltaXplZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgLy8gTG9hZCBhdXRoIHRva2VuIG9uIG1vdW50XG4gIG9uTW91bnQoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTG9hZGluZyBhdXRoIHRva2VuJyk7XG4gICAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIHNldEF1dGhUb2tlbih0b2tlbik7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1dGggdG9rZW4gbG9hZGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBkZW1vIHRva2VuIGZvciBkZXZlbG9wbWVudFxuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBhdXRoIHRva2VuIGZvdW5kLCB1c2luZyBkZW1vIHRva2VuJyk7XG4gICAgICBzZXRBdXRoVG9rZW4oJ3NjYXJsZXR0X2RlbW9fdG9rZW5fMTIzJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0YXJ0IHdhdGNoaW5nIGZvciB0cmFjayBjaGFuZ2VzXG4gICAgY29uc3QgY2xlYW51cCA9IHRyYWNrRGV0ZWN0b3Iud2F0Y2hGb3JDaGFuZ2VzKCh0cmFjaykgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBUcmFjayBjaGFuZ2VkOicsIHRyYWNrKTtcbiAgICAgIHNldEN1cnJlbnRUcmFjayh0cmFjayk7XG4gICAgICAvLyBTaG93IGthcmFva2Ugd2hlbiB0cmFjayBpcyBkZXRlY3RlZFxuICAgICAgaWYgKHRyYWNrKSB7XG4gICAgICAgIHNldFNob3dLYXJhb2tlKHRydWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgb25DbGVhbnVwKGNsZWFudXApO1xuICB9KTtcblxuICBjb25zdCBoYW5kbGVDb21wbGV0ZSA9IChyZXN1bHRzOiBhbnkpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEthcmFva2Ugc2Vzc2lvbiBjb21wbGV0ZWQ6JywgcmVzdWx0cyk7XG4gICAgLy8gVE9ETzogU2hvdyBjb21wbGV0aW9uIHNjcmVlbiwgc2F2ZSByZXN1bHRzLCBldGMuXG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ2xvc2UgPSAoKSA9PiB7XG4gICAgc2V0U2hvd0thcmFva2UoZmFsc2UpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZU1pbmltaXplID0gKCkgPT4ge1xuICAgIHNldElzTWluaW1pemVkKCFpc01pbmltaXplZCgpKTtcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e3Nob3dLYXJhb2tlKCkgJiYgY3VycmVudFRyYWNrKCkgJiYgYXV0aFRva2VuKCl9PlxuICAgICAgPGRpdiBcbiAgICAgICAgY2xhc3M9XCJrYXJhb2tlLXdpZGdldFwiXG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgICAgdG9wOiBpc01pbmltaXplZCgpID8gJ2F1dG8nIDogJzIwcHgnLFxuICAgICAgICAgIHJpZ2h0OiAnMjBweCcsXG4gICAgICAgICAgYm90dG9tOiAnMjBweCcsXG4gICAgICAgICAgd2lkdGg6IGlzTWluaW1pemVkKCkgPyAnODBweCcgOiAnNTAwcHgnLFxuICAgICAgICAgIGhlaWdodDogaXNNaW5pbWl6ZWQoKSA/ICc4MHB4JyA6ICdhdXRvJyxcbiAgICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICAgICdib3JkZXItcmFkaXVzJzogJzE2cHgnLFxuICAgICAgICAgICdib3gtc2hhZG93JzogJzAgMjVweCA1MHB4IC0xMnB4IHJnYmEoMCwgMCwgMCwgMC42KScsXG4gICAgICAgICAgdHJhbnNpdGlvbjogJ2FsbCAwLjNzIGVhc2UnLFxuICAgICAgICAgIGJhY2tncm91bmQ6ICcjMGEwYTBhJyxcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgey8qIEhlYWRlciBjb250cm9scyAqL31cbiAgICAgICAgPGRpdiBcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAgICAgJ2p1c3RpZnktY29udGVudCc6ICdzcGFjZS1iZXR3ZWVuJyxcbiAgICAgICAgICAgICdhbGlnbi1pdGVtcyc6ICdjZW50ZXInLFxuICAgICAgICAgICAgcGFkZGluZzogJzEycHggMTZweCcsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAnIzE2MTYxNicsXG4gICAgICAgICAgICAnYm9yZGVyLWJvdHRvbSc6ICcxcHggc29saWQgIzI2MjYyNicsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBnYXA6ICc4cHgnLCAnYWxpZ24taXRlbXMnOiAnY2VudGVyJyB9fT5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7ICdmb250LXNpemUnOiAnMjBweCcgfX0+8J+OpDwvc3Bhbj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49eyFpc01pbmltaXplZCgpfT5cbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICcjZmFmYWZhJywgJ2ZvbnQtd2VpZ2h0JzogJzYwMCcgfX0+U2NhcmxldHQ8L3NwYW4+XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPFNob3cgd2hlbj17IWlzTWluaW1pemVkKCl9PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGdhcDogJzhweCcgfX0+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVNaW5pbWl6ZX1cbiAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogJ25vbmUnLFxuICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICBjb2xvcjogJyNhOGE4YTgnLFxuICAgICAgICAgICAgICAgICAgY3Vyc29yOiAncG9pbnRlcicsXG4gICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnNHB4JyxcbiAgICAgICAgICAgICAgICAgICdmb250LXNpemUnOiAnMThweCcsXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICB0aXRsZT1cIk1pbmltaXplXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIOKIklxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUNsb3NlfVxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgICAgICAgICAgIGNvbG9yOiAnI2E4YThhOCcsXG4gICAgICAgICAgICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcbiAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICc0cHgnLFxuICAgICAgICAgICAgICAgICAgJ2ZvbnQtc2l6ZSc6ICcxOHB4JyxcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgIHRpdGxlPVwiQ2xvc2VcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgw5dcbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBLYXJhb2tlIGNvbnRlbnQgKi99XG4gICAgICAgIDxTaG93IHdoZW49eyFpc01pbmltaXplZCgpfT5cbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGhlaWdodDogJ2NhbGMoMTAwJSAtIDQ5cHgpJyB9fT5cbiAgICAgICAgICAgIDxLYXJhb2tlU2Vzc2lvblxuICAgICAgICAgICAgICB0cmFja0lkPXtjdXJyZW50VHJhY2soKSEudHJhY2tJZH1cbiAgICAgICAgICAgICAgdHJhY2tUaXRsZT17Y3VycmVudFRyYWNrKCkhLnRpdGxlfVxuICAgICAgICAgICAgICBhcnRpc3Q9e2N1cnJlbnRUcmFjaygpIS5hcnRpc3R9XG4gICAgICAgICAgICAgIGF1dGhUb2tlbj17YXV0aFRva2VuKCkhfVxuICAgICAgICAgICAgICBvbkNvbXBsZXRlPXtoYW5kbGVDb21wbGV0ZX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvU2hvdz5cblxuICAgICAgICB7LyogTWluaW1pemVkIHZpZXcgKi99XG4gICAgICAgIDxTaG93IHdoZW49e2lzTWluaW1pemVkKCl9PlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZU1pbmltaXplfVxuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgd2lkdGg6ICcxMDAlJyxcbiAgICAgICAgICAgICAgaGVpZ2h0OiAnMTAwJScsXG4gICAgICAgICAgICAgIGJhY2tncm91bmQ6ICdub25lJyxcbiAgICAgICAgICAgICAgYm9yZGVyOiAnbm9uZScsXG4gICAgICAgICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXG4gICAgICAgICAgICAgICdhbGlnbi1pdGVtcyc6ICdjZW50ZXInLFxuICAgICAgICAgICAgICAnanVzdGlmeS1jb250ZW50JzogJ2NlbnRlcicsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7ICdmb250LXNpemUnOiAnMzJweCcgfX0+8J+OpDwvc3Bhbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaGFkb3dSb290VWkgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtdWkvc2hhZG93LXJvb3QnO1xuaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0JztcbmltcG9ydCB7IHJlbmRlciB9IGZyb20gJ3NvbGlkLWpzL3dlYic7XG5pbXBvcnQgeyBDb250ZW50QXBwIH0gZnJvbSAnLi4vc3JjL2FwcHMvY29udGVudC9Db250ZW50QXBwJztcbmltcG9ydCAnLi4vc3JjL3N0eWxlcy9leHRlbnNpb24uY3NzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnKjovL3NvdW5kY2xvdWQuY29tLyonLCAnKjovL3NvdW5kY2xvYWsuY29tLyonLCAnKjovL3NjLm1haWQuem9uZS8qJywgJyo6Ly8qLm1haWQuem9uZS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIGNzc0luamVjdGlvbk1vZGU6ICd1aScsXG5cbiAgYXN5bmMgbWFpbihjdHg6IENvbnRlbnRTY3JpcHRDb250ZXh0KSB7XG4gICAgLy8gT25seSBydW4gaW4gdG9wLWxldmVsIGZyYW1lIHRvIGF2b2lkIGR1cGxpY2F0ZSBwcm9jZXNzaW5nIGluIGlmcmFtZXNcbiAgICBpZiAod2luZG93LnRvcCAhPT0gd2luZG93LnNlbGYpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIE5vdCB0b3AtbGV2ZWwgZnJhbWUsIHNraXBwaW5nIGNvbnRlbnQgc2NyaXB0LicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIFNjYXJsZXR0IEthcmFva2UgY29udGVudCBzY3JpcHQgbG9hZGVkJyk7XG5cbiAgICAvLyBDcmVhdGUgc2hhZG93IERPTSBhbmQgbW91bnQga2FyYW9rZSB3aWRnZXRcbiAgICBjb25zdCB1aSA9IGF3YWl0IGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIHtcbiAgICAgIG5hbWU6ICdzY2FybGV0dC1rYXJhb2tlLXVpJyxcbiAgICAgIHBvc2l0aW9uOiAnb3ZlcmxheScsXG4gICAgICBhbmNob3I6ICdib2R5JyxcbiAgICAgIG9uTW91bnQ6IChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIG9uTW91bnQgY2FsbGVkLCBjb250YWluZXI6JywgY29udGFpbmVyKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gU2hhZG93IHJvb3Q6JywgY29udGFpbmVyLmdldFJvb3ROb2RlKCkpO1xuICAgICAgICBcbiAgICAgICAgLy8gTG9nIHdoYXQgc3R5bGVzaGVldHMgYXJlIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBzaGFkb3dSb290ID0gY29udGFpbmVyLmdldFJvb3ROb2RlKCkgYXMgU2hhZG93Um9vdDtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gU2hhZG93IHJvb3Qgc3R5bGVzaGVldHM6Jywgc2hhZG93Um9vdC5zdHlsZVNoZWV0cz8ubGVuZ3RoKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENyZWF0ZSB3cmFwcGVyIHdpdGggcG9zaXRpb25pbmdcbiAgICAgICAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICAgIHRvcDogMjBweDtcbiAgICAgICAgICByaWdodDogMjBweDtcbiAgICAgICAgICBib3R0b206IDIwcHg7XG4gICAgICAgICAgd2lkdGg6IDUwMHB4O1xuICAgICAgICAgIHotaW5kZXg6IDk5OTk5O1xuICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMTZweDtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDI1cHggNTBweCAtMTJweCByZ2JhKDAsIDAsIDAsIDAuNik7XG4gICAgICAgIGA7XG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2thcmFva2Utd2lkZ2V0JztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHdyYXBwZXIpO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIFdyYXBwZXIgY3JlYXRlZCBhbmQgYXBwZW5kZWQ6Jywgd3JhcHBlcik7XG5cbiAgICAgICAgY29uc3QgdW5tb3VudCA9IHJlbmRlcigoKSA9PiA8Q29udGVudEFwcCAvPiwgd3JhcHBlcik7XG5cbiAgICAgICAgcmV0dXJuIHVubW91bnQ7XG4gICAgICB9LFxuICAgICAgb25SZW1vdmU6IChjbGVhbnVwPzogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgICBjbGVhbnVwPy4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBNb3VudCB0aGUgVUlcbiAgICB1aS5tb3VudCgpO1xuICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIEthcmFva2Ugb3ZlcmxheSBtb3VudGVkJyk7XG4gIH0sXG59KTsiLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJ2YWx1ZSIsImkiLCJzb3VyY2VzIiwiZGlzcG9zZSIsImRvY3VtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsImJyb3dzZXIiLCJfYnJvd3NlciIsImlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUiLCJzdHlsZSIsInByaW50IiwibG9nZ2VyIiwiX2EiLCJfYiIsInJlc3VsdCIsInJlbW92ZURldGVjdG9yIiwibW91bnREZXRlY3RvciIsImRlZmluaXRpb24iLCJfJGRlbGVnYXRlRXZlbnRzIiwiQnV0dG9uIiwicHJvcHMiLCJsb2NhbCIsIm90aGVycyIsInNwbGl0UHJvcHMiLCJ2YXJpYW50Iiwic2l6ZSIsIl9lbCQiLCJfdG1wbCQzIiwiXyRzcHJlYWQiLCJfJG1lcmdlUHJvcHMiLCJkaXNhYmxlZCIsImxvYWRpbmciLCJjbiIsImZ1bGxXaWR0aCIsImNsYXNzIiwiXyRjcmVhdGVDb21wb25lbnQiLCJTaG93Iiwid2hlbiIsImNoaWxkcmVuIiwiX3RtcGwkIiwibGVmdEljb24iLCJfZWwkMyIsIl90bXBsJDIiLCJyaWdodEljb24iLCJMeXJpY3NEaXNwbGF5IiwiY3VycmVudExpbmVJbmRleCIsInNldEN1cnJlbnRMaW5lSW5kZXgiLCJjcmVhdGVTaWduYWwiLCJjb250YWluZXJSZWYiLCJjcmVhdGVFZmZlY3QiLCJjdXJyZW50VGltZSIsInRpbWUiLCJpbmRleCIsImx5cmljcyIsImZpbmRJbmRleCIsImxpbmUiLCJlbmRUaW1lIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJpc1BsYXlpbmciLCJsaW5lRWxlbWVudHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3VycmVudEVsZW1lbnQiLCJjb250YWluZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJsaW5lVG9wIiwib2Zmc2V0VG9wIiwibGluZUhlaWdodCIsIm9mZnNldEhlaWdodCIsInNjcm9sbFRvcCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfZWwkMiIsImZpcnN0Q2hpbGQiLCJfcmVmJCIsIl8kdXNlIiwiRm9yIiwiZWFjaCIsInRleHQiLCJfJGVmZmVjdCIsIl9wJCIsIl92JCIsIl92JDIiLCJlIiwiXyRzZXRBdHRyaWJ1dGUiLCJ0IiwiXyRjbGFzc05hbWUiLCJ1bmRlZmluZWQiLCJzYW1wbGVSYXRlIiwib2Zmc2V0IiwidGl0bGUiLCJDYXJkIiwicGFkZGluZyIsIlByb2dyZXNzQmFyIiwicGVyY2VudGFnZSIsIk1hdGgiLCJtaW4iLCJtYXgiLCJjdXJyZW50IiwidG90YWwiLCJzZXRQcm9wZXJ0eSIsInJlbW92ZVByb3BlcnR5IiwiS2FyYW9rZUNvbXBsZXRpb24iLCJnZXRHcmFkZSIsInNjb3JlIiwiZ2V0R3JhZGVDb2xvciIsImdyYWRlIiwiZ2V0RmVlZGJhY2siLCJvdmVyYWxsU2NvcmUiLCJncmFkZUNvbG9yIiwiaXNBbmFseXppbmciLCJmYWxsYmFjayIsIl9lbCQ0IiwiX3RtcGwkNCIsIl9lbCQ1IiwiaXNOZXdCZXN0U2NvcmUiLCJfZWwkNiIsInN0eWxlcyIsIm5ld0Jlc3RTY29yZSIsIl92JDMiLCJoZWFkZXIiLCJfdiQ0Iiwic2NvcmVDYXJkIiwiX2VsJDciLCJfdG1wbCQ1IiwiX2VsJDgiLCJfZWwkOSIsIm5leHRTaWJsaW5nIiwiXyRpbnNlcnQiLCJzb25nIiwiYXJ0aXN0Iiwic29uZ0luZm8iLCJfZWwkMCIsIl90bXBsJDYiLCJfZWwkMSIsIl9lbCQxMCIsIl9lbCQxMSIsIl9lbCQxMiIsInJvdW5kIiwiX3YkNSIsInNjb3JlRGlzcGxheSIsIl92JDYiLCJfdiQ3IiwiX3YkOCIsIl92JDkiLCJzY29yZVZhbHVlIiwiX3YkMCIsInNjb3JlTGFiZWwiLCJhIiwibyIsIm4iLCJfZWwkMTMiLCJfdG1wbCQ3IiwiZmVlZGJhY2siLCJsaW5lUmVzdWx0cyIsImxlbmd0aCIsImRldGFpbHNDYXJkIiwiX2VsJDE0IiwiX3RtcGwkOCIsImRldGFpbHNUaXRsZSIsIl9lbCQxNSIsIl9lbCQxNyIsIl90bXBsJDkiLCJfZWwkMTgiLCJfZWwkMTkiLCJfZWwkMjAiLCJfZWwkMjEiLCJsaW5lUHJvZ3Jlc3MiLCJfdiQxIiwibGluZVJlc3VsdCIsIl92JDEwIiwibGluZVRleHQiLCJfdiQxMSIsImxpbmVTY29yZSIsIl92JDEyIiwibGluZVNjb3JlVmFsdWUiLCJfZWwkMTYiLCJvbkNsaWNrIiwib25UcnlBZ2FpbiIsImFjdGlvbnMiLCJhbmFseXppbmciLCJzcGlubmVyIiwiY29tcGxldGlvbiIsIkthcmFva2VTZXNzaW9uIiwiYXVkaW9Qcm9jZXNzb3IiLCJjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3IiLCJzdG9yZSIsImNyZWF0ZUthcmFva2VTdG9yZSIsImthcmFva2VBcGkiLCJLYXJhb2tlQXBpU2VydmljZSIsImN1cnJlbnRBdWRpb1RpbWUiLCJzZXRDdXJyZW50QXVkaW9UaW1lIiwiaXNBdWRpb1BsYXlpbmciLCJzZXRJc0F1ZGlvUGxheWluZyIsImNvdW50ZG93blNlY29uZHMiLCJzZXRDb3VudGRvd25TZWNvbmRzIiwic2hvd0NvbXBsZXRpb24iLCJzZXRTaG93Q29tcGxldGlvbiIsInNldElzQW5hbHl6aW5nIiwic2Vzc2lvblJlc3VsdHMiLCJzZXRTZXNzaW9uUmVzdWx0cyIsInVzZXJCZXN0U2NvcmUiLCJzZXRVc2VyQmVzdFNjb3JlIiwic2V0SXNOZXdCZXN0U2NvcmUiLCJtZXNzYWdlIiwic2V0TWVzc2FnZSIsImdldEF1ZGlvRWxlbWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJjb25uZWN0VG9TZXJ2ZXIiLCJjb25uZWN0aW9uU3RhdHVzIiwic2V0Q29ubmVjdGlvblN0YXR1cyIsImRhdGEiLCJmZXRjaEthcmFva2VEYXRhIiwidHJhY2tJZCIsInRyYWNrVGl0bGUiLCJzZXRLYXJhb2tlRGF0YSIsImhhc19rYXJhb2tlIiwidHlwZSIsImhhc1RpbWVkTHlyaWNzIiwibGluZXMiLCJzb21lIiwidGltZXN0YW1wIiwibG9nIiwiZ2VuaXVzX2lkIiwiYXV0aFRva2VuIiwiYmVzdFNjb3JlIiwiZ2V0VXNlckJlc3RTY29yZSIsIkVycm9yIiwiZXJyb3IiLCJoYW5kbGVTdGFydEthcmFva2UiLCJjb3VudCIsImNvdW50ZG93bkludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJjbGVhckludGVydmFsIiwic2V0SXNLYXJhb2tlQWN0aXZlIiwic3RhcnRLYXJhb2tlU2Vzc2lvbiIsImthcmFva2VEYXRhIiwiaXNSZWFkeSIsImluaXRpYWxpemUiLCJzdGFydEZ1bGxTZXNzaW9uIiwiY29uc29sZSIsImF1ZGlvIiwic2Vzc2lvbiIsInN0YXJ0U2Vzc2lvbiIsInNldEN1cnJlbnRTZXNzaW9uIiwicmVzZXRTY29yaW5nIiwic3RhcnRfdGltZSIsInBhdXNlZCIsInBsYXkiLCJoYW5kbGVTdGFydFJlY29yZGluZyIsImxpbmVJbmRleCIsImlzUmVjb3JkaW5nIiwic2V0Q3VycmVudFJlY29yZGluZ0xpbmUiLCJzZXRJc1JlY29yZGluZyIsImNodW5rSW5mbyIsInNob3VsZENodW5rTGluZXMiLCJpc0NodW5rZWQiLCJlbmRJbmRleCIsIndvcmRDb3VudCIsImxpbmVEdXJhdGlvbiIsImNhbGN1bGF0ZVJlY29yZGluZ0R1cmF0aW9uIiwic3RhcnRSZWNvcmRpbmdMaW5lIiwiaXNMaXN0ZW5pbmciLCJzdGFydExpc3RlbmluZyIsInNldFRpbWVvdXQiLCJhdWRpb0NodW5rcyIsInN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8iLCJ3YXZCbG9iIiwiY29udmVydEF1ZGlvVG9XYXZCbG9iIiwiYXJyYXlCdWZmZXIiLCJ1aW50OEFycmF5IiwiVWludDhBcnJheSIsImJpbmFyeVN0cmluZyIsImNodW5rU2l6ZSIsImNodW5rIiwic2xpY2UiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJhdWRpb0RhdGEiLCJidG9hIiwic3VibWl0UmVjb3JkaW5nIiwiZXhwZWN0ZWRUZXh0IiwibWFpblNjb3JlIiwibGluZVNjb3JlcyIsImdldCIsInVwZGF0ZUxpbmVTY29yZSIsImNodW5rZWRUZXh0IiwiY3VycmVudFNlc3Npb24iLCJncmFkZVJlY29yZGluZyIsInNlc3Npb25faWQiLCJhdHRlbXB0cyIsInRyaWdnZXJTZXNzaW9uQ29tcGxldGlvbiIsInBhdXNlIiwic2Vzc2lvbldhdiIsInN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdiIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJhdWRpb0Jhc2U2NCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwib25sb2FkZW5kIiwiYmFzZTY0Iiwic3BsaXQiLCJvbmVycm9yIiwicmVhZEFzRGF0YVVSTCIsInJlc3VsdHMiLCJjb21wbGV0ZVNlc3Npb24iLCJzZXNzaW9uU2NvcmUiLCJ0b3RhbFNjb3JlIiwiY3VycmVudEJlc3RTY29yZSIsIm9uQ29tcGxldGUiLCJoYW5kbGVSZXRyeUthcmFva2UiLCJpc0thcmFva2VBY3RpdmUiLCJjdXJyZW50UmVjb3JkaW5nIiwiY3VycmVudFJlY29yZGluZ0xpbmUiLCJsaW5lVG9SZWNvcmQiLCJyZWNvcmRpbmdTdGFydCIsInJlY29yZGluZ0VuZCIsImhhcyIsIm9uTW91bnQiLCJ1cGRhdGVUaW1lIiwiaGFuZGxlVGltZVVwZGF0ZSIsImhhbmRsZVBsYXkiLCJoYW5kbGVQYXVzZSIsImhhbmRsZUVuZGVkIiwib25DbGVhbnVwIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm1hcCIsInBlcmZvcm1hbmNlU3RhdGUiLCJwZXJmb3JtYW5jZVNjb3JlIiwib25TdGFydEthcmFva2UiLCJvblJldHJ5Q29ubmVjdGlvbiIsInN0YXR1c01lc3NhZ2UiLCJkaWZmaWN1bHR5Iiwic29uZ0lkIiwidHJhY2tfaWQiLCJDb250ZW50QXBwIiwiY3VycmVudFRyYWNrIiwic2V0Q3VycmVudFRyYWNrIiwic2V0QXV0aFRva2VuIiwic2hvd0thcmFva2UiLCJzZXRTaG93S2FyYW9rZSIsImlzTWluaW1pemVkIiwic2V0SXNNaW5pbWl6ZWQiLCJ0b2tlbiIsImdldEF1dGhUb2tlbiIsImNsZWFudXAiLCJ0cmFja0RldGVjdG9yIiwid2F0Y2hGb3JDaGFuZ2VzIiwidHJhY2siLCJoYW5kbGVDb21wbGV0ZSIsImhhbmRsZUNsb3NlIiwiaGFuZGxlTWluaW1pemUiLCJfJG1lbW8iLCIkJGNsaWNrIiwiZGVmaW5lQ29udGVudFNjcmlwdCIsIm1hdGNoZXMiLCJydW5BdCIsImNzc0luamVjdGlvbk1vZGUiLCJtYWluIiwiY3R4Iiwid2luZG93Iiwic2VsZiIsInVpIiwiY3JlYXRlU2hhZG93Um9vdFVpIiwibmFtZSIsInBvc2l0aW9uIiwiYW5jaG9yIiwiY29udGFpbmVyIiwiZ2V0Um9vdE5vZGUiLCJzaGFkb3dSb290Iiwic3R5bGVTaGVldHMiLCJ3cmFwcGVyIiwiY3JlYXRlRWxlbWVudCIsImNzc1RleHQiLCJjbGFzc05hbWUiLCJhcHBlbmRDaGlsZCIsInVubW91bnQiLCJyZW5kZXIiLCJvblJlbW92ZSIsIm1vdW50Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFnSkEsUUFBTSxTQUFTO0FBQ2YsUUFBTSxVQUFVLENBQUMsR0FBRyxNQUFNLE1BQU07QUFDaEMsUUFBTSxTQUFTLE9BQU8sYUFBYTtBQUNuQyxRQUFNLGlCQUFpQixPQUFPLFVBQVU7QUFDeEMsUUFBTSxTQUFTLE9BQU8sYUFBYTtBQUNuQyxRQUFNLFdBQVcsT0FBTyxxQkFBcUI7QUFDN0MsUUFBTSxnQkFBZ0I7QUFBQSxJQUNwQixRQUFRO0FBQUEsRUFDVjtBQUVBLE1BQUksYUFBYTtBQUNqQixRQUFNLFFBQVE7QUFDZCxRQUFNLFVBQVU7QUFDaEIsUUFBTSxVQUFVLENBS2hCO0FBRUEsTUFBSSxRQUFRO0FBQ1osTUFBSSxhQUFhO0FBRWpCLE1BQUksdUJBQXVCO0FBQzNCLE1BQUksV0FBVztBQUNmLE1BQUksVUFBVTtBQUNkLE1BQUksVUFBVTtBQUNkLE1BQUksWUFBWTtBQU9oQixXQUFTLFdBQVcsSUFBSSxlQUFlO0FBQ3JDLFVBQU0sV0FBVyxVQUNmLFFBQVEsT0FDUixVQUFVLEdBQUcsV0FBVyxHQUN4QixVQUFVLGtCQUFrQixTQUFZLFFBQVEsZUFDaEQsT0FBTyxVQUFVO0FBQUEsTUFDZixPQUFPO0FBQUEsTUFDUCxVQUFVO0FBQUEsTUFDVixTQUFTO0FBQUEsTUFDVCxPQUFPO0FBQUEsSUFBQSxJQUNKO0FBQUEsTUFDSCxPQUFPO0FBQUEsTUFDUCxVQUFVO0FBQUEsTUFDVixTQUFTLFVBQVUsUUFBUSxVQUFVO0FBQUEsTUFDckMsT0FBTztBQUFBLElBRVQsR0FBQSxXQUFXLFVBQVUsTUFBTSxHQUFHLE1BQU07QUFDNUIsWUFBQSxJQUFJLE1B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QUFBQSxRQUNBO0FBQUEsVUFDRSxHQUFHO0FBQUEsVUFDSCxRQUFRLEtBQUs7QUFBQSxRQUNyQjtBQUFBO0FBQUEsSUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLRSxvQkFBb0I7QUFDbEIsV0FBSyxNQUFNLG9DQUFvQztBQUMvQ0QsZUFBTztBQUFBLFFBQ0wsbUJBQW1CLEtBQUssaUJBQWlCO0FBQUEsTUFDMUM7QUFBQSxJQUNMO0FBQUEsSUFDRSxpQkFBaUI7QUFDZixhQUFPO0FBQUEsUUFDTDtBQUFBLFVBQ0UsTUFBTSxzQkFBcUI7QUFBQSxVQUMzQixtQkFBbUIsS0FBSztBQUFBLFVBQ3hCLFdBQVcsS0FBSyxPQUFRLEVBQUMsU0FBUyxFQUFFLEVBQUUsTUFBTSxDQUFDO0FBQUEsUUFDOUM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0w7QUFBQSxJQUNFLHlCQUF5QixPQUFPOztBQUM5QixZQUFNLHlCQUF1QkMsTUFBQSxNQUFNLFNBQU4sZ0JBQUFBLElBQVksVUFBUyxzQkFBcUI7QUFDdkUsWUFBTSx3QkFBc0JDLE1BQUEsTUFBTSxTQUFOLGdCQUFBQSxJQUFZLHVCQUFzQixLQUFLO0FBQ25FLFlBQU0saUJBQWlCLENBQUMsS0FBSyxtQkFBbUIsS0FBSSxXQUFNLFNBQU4sbUJBQVksU0FBUztBQUN6RSxhQUFPLHdCQUF3Qix1QkFBdUI7QUFBQSxJQUMxRDtBQUFBLElBQ0Usc0JBQXNCLFNBQVM7QUFDN0IsVUFBSSxVQUFVO0FBQ2QsWUFBTSxLQUFLLENBQUMsVUFBVTtBQUNwQixZQUFJLEtBQUsseUJBQXlCLEtBQUssR0FBRztBQUN4QyxlQUFLLG1CQUFtQixJQUFJLE1BQU0sS0FBSyxTQUFTO0FBQ2hELGdCQUFNLFdBQVc7QUFDakIsb0JBQVU7QUFDVixjQUFJLGFBQVksbUNBQVMsa0JBQWtCO0FBQzNDLGVBQUssa0JBQW1CO0FBQUEsUUFDaEM7QUFBQSxNQUNLO0FBQ0QsdUJBQWlCLFdBQVcsRUFBRTtBQUM5QixXQUFLLGNBQWMsTUFBTSxvQkFBb0IsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUMvRDtBQUFBLEVBQ0E7QUFySkUsZ0JBWlcsdUJBWUosK0JBQThCO0FBQUEsSUFDbkM7QUFBQSxFQUNEO0FBZEksTUFBTSx1QkFBTjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEsMiwzLDQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDM3LDM4LDM5XX0=

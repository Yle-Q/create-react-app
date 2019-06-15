/* eslint-disable */
export {};

const ReactFreshRuntime = require('./react-fresh/runtime');

let currentModuleID = null;
window.__setCurrentModule__ = function(m) {
  currentModuleID = m.id;
};

let scheduleHotUpdate;
let roots = new Set();
let knownTypes = new WeakSet();

if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject() {},
    onCommitFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
  };
}
function patchHook(method, intercept) {
  let oldFn = window.__REACT_DEVTOOLS_GLOBAL_HOOK__[method];
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__[method] = (...args) => {
    intercept(...args);
    return oldFn(...args);
  };
}
patchHook('inject', injected => {
  scheduleHotUpdate = injected.scheduleHotUpdate;
});
patchHook('onCommitFiberRoot', (id, root) => {
  // TODO: properly track roots
  roots.add(root);
});

const REACT_PROVIDER_TYPE = Symbol.for('react.provider');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_MEMO_TYPE = Symbol.for('react.memo');

window.__shouldAccept__ = function(exports) {
  for (let key in exports) {
    const val = exports[key];
    if (!val) {
      return false;
    }
    if (typeof val === 'string') {
      return false;
    }
    if (typeof val === 'object') {
      switch (val.$$typeof) {
        case REACT_MEMO_TYPE:
        case REACT_FORWARD_REF_TYPE:
          continue;
        // case REACT_PROVIDER_TYPE:
        // case REACT_CONTEXT_TYPE:
        //   return false;
        default:
          return false;
      }
    }
    if (typeof val === 'function') {
      if (val.prototype) {
        if (val.prototype.isReactComponent) {
          return true;
        }
        for (let inner in val.prototype) {
          return false;
        }
      }
    }
    if (knownTypes.has(val)) {
      continue;
    }
    return false;
  }
  // All exports are component-ish.
  return true;
};

function __register__(type, id) {
  if (
    (typeof type !== 'function' && typeof type !== 'object') ||
    type == null
  ) {
    return;
  }
  knownTypes.add(type);
  const fullID = currentModuleID + '%' + id;
  ReactFreshRuntime.register(type, fullID);
  scheduleHotReload();
}
window.__register__ = __register__;

function __signature__() {
  let call = 0;
  let savedType;
  let hasCustomHooks;
  return function(type, key, forceReset, getCustomHooks) {
    switch (call++) {
      case 0:
        savedType = type;
        hasCustomHooks = typeof getCustomHooks === 'function';
        ReactFreshRuntime.setSignature(type, key, forceReset, getCustomHooks);
        break;
      case 1:
        if (hasCustomHooks) {
          ReactFreshRuntime.collectCustomHooksForSignature(savedType);
        }
        break;
    }
    return type;
  };
}
window.__signature__ = __signature__;

let waitHandle = null;
function scheduleHotReload() {
  if (!waitHandle) {
    waitHandle = setTimeout(() => {
      waitHandle = null;

      const update = ReactFreshRuntime.prepareUpdate();
      if (update === null) {
        return;
      }
      roots.forEach(root => scheduleHotUpdate(root, update));
      // TODO
    }, 30);
  }
}

function highlightNodes(nodes) {
  let rects = nodes.map(node => node.getBoundingClientRect());
  let layer = ensureLayer();

  layer.innerHTML = '';
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const div = document.createElement('div');
    Object.assign(div.style, rectStyles, {
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
    layer.appendChild(div);
  }
  layer.style.transition = 'none';
  layer.style.opacity = 1;
  setTimeout(() => {
    layer.style.transition = 'opacity 2s ease-in';
    layer.style.opacity = 0;
  }, 100);
}

const layerStyles = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  border: 'none',
  pointerEvents: 'none',
  zIndex: 2147483647,
};

const rectStyles = {
  position: 'absolute',
  border: '1px rgb(97, 218, 251) solid',
  backgroundColor: 'rgba(97, 218, 251, 0.1)',
};

let l;
function ensureLayer() {
  if (l) {
    return l;
  }
  // TODO: iframe
  l = document.createElement('div');
  Object.assign(l.style, layerStyles);
  document.body.appendChild(l);
  return l;
}

# createApp 流程解析

## createApp 做了什么事？

官网解释：
> 返回一个提供应用上下文的应用实例。应用实例挂载的整个组件树共享同一个上下文，可以在 createApp 之后链式调用其它方法。

个人理解总结：
1. 创建 vue 应用实例
2. 初始化应用上下文
3. 实现链式调用

### 创建 vue 应用实例
根据官网的解释，createApp 主要的作用就是创建 vue 应用实例，这里可以从下面源码分析知道，通过调用 `ensureRenderer().createApp(...args)` 方法
返回 app 对象，并且初始化 app.mount 方法，通过调用 createApp 方法返回 app 对象。

从源码也可以看出 createApp 是 runtime-dom api。  

> runtime-dom 模块：主要负责浏览器环境的渲染和 ssr 渲染

```ts
// packages/runtime-dom/src/index.ts
export const createApp = ((...args) => {
  // 创建 vue app
  const app = ensureRenderer().createApp(...args)
  
  // 初始化 app.mount 方法
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => { }
  
  return app
})
```

**创建 vue 应用实例和核心逻辑在 renderer 对象的 createApp 方法中实现**

ensureRenderer 初始化 renderer 方法时，会初始化 renderer.createApp 方法，下面是 createApp 实现相关的源码

```ts
// todo
```

那么如何理解官网的其他解释： `应用实例挂载的整个组件树共享同一个上下文`、`在 createApp 之后链式调用其它方法` 呢？我们继续从源码中找答案。

### 初始化应用上下文

我对 `应用实例挂载的整个组件树共享同一个上下文` 的理解是在调用 createApp 时会创建应用和组件的上下文环境，这里的上下文并不只是一个或某个上下文环境，
比如每个组件都可以调用组件级的上下文环境和app级的上下文环境等，具体行为要通过源码进行分析。

**我们先来看调用 ensureRenderer 函数的过程**

```ts
// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
let renderer: Renderer<Element | ShadowRoot> | HydrationRenderer

function ensureRenderer(): Renderer<Element | ShadowRoot> {
  return (
    renderer ||
    (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  )
}
```

ensureRenderer 也是 runtime-dom 模块的方法，根据源码可以看出 ensureRenderer 函数主要是调用 createRenderer 初始化 renderer 对象或者返回缓存的 renderer，表示 renderer 对象只会初始化一次。
根据 renderer 对象的声明和后续源码可以知道，传入 rendererOptions（平台相关的配置参数） 调用 createRenderer 函数后，返回由 render 函数和 createApp 方法组成的对象，
所以 renderer 存在的目的就是初始化 render 和 createApp 具体实现方法，并且还支持 ssr 渲染器的缓存。
或者可以说 runtime-dom 的 renderer 主要负责浏览器平台的渲染，rendererOptions 参数保存了 dom操作和dom元素属性的 patch操作。

**对createRenderer 函数的解释**

createRenderer 声明在 runtime-core 模块中，源码如下，返回 baseCreateRenderer。
这里 createRenderer 封装了 baseCreateRenderer 函数，返回非 ssr renderer 对象、和 createHydrationRenderer 函数（ssr renderer）区分（参数不同）
具体实现实在 baseCreateRenderer 方法中，ssr renderer 和 普通 renderer 的区别是 ssr renderer 会多初始化一个 hydrate 函数。

> runtime-core 模块：与平台无关的通用逻辑和 运行时api，包括了如 vue3 api、vnode、patch方法等

```ts
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options)
}
```

**baseCreateRenderer - 核心渲染逻辑**

baseCreateRenderer 函数主负责渲染器对象的核心实现，这个函数大约有 2000 行代码，主要是初始化 patch 方法、实现 patch 逻辑、初始化 render 方法、初始化了创建 vue 应用实例的函数等。
是在 runtime 阶段最核心的方法，后面需要单独对 patch 过程和 render 函数进行分析。 

```ts
// packages/runtime-core/src/renderer.ts
function baseCreateRenderer(
  options: RendererOptions,
  createHydrationFns?: typeof createHydrationFunctions
): any {
  
  // dom api
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    cloneNode: hostCloneNode,
    insertStaticContent: hostInsertStaticContent
  } = options
  
  // patch 方法
  const patch: PatchFn = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null,
    parentSuspense = null,
    isSVG = false,
    slotScopeIds = null,
    optimized = __DEV__ && isHmrUpdating ? false : !!n2.dynamicChildren
  ) => {
    // diff 与 patch 逻辑 ...
  }
  
  // 下面是对 patch 方法依赖的与dom节点或属性操作等相关的 api 的封装方法
  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    // dom元素 patch
  }

  const patchProps = (
    el: RendererElement,
    vnode: VNode,
    oldProps: Data,
    newProps: Data,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean
  ) => {
    // dom 元素属性 patch
  }
  
  // ...
  
  // render 函数
  const render: RootRenderFunction = (vnode, container, isSVG) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true)
      }
    } else {
      patch(container._vnode || null, vnode, container, null, null, null, isSVG)
    }
    flushPostFlushCbs()
    container._vnode = vnode
  }
  
  // 这里是 ssr 渲染相关的 api

  return {
    render,
    hydrate,
    createApp: createAppAPI(render, hydrate) // 这里方法通过 createAppAPI 创建了 vue 应用实例对象，依赖 render 函数
  }
}
```

### 实现链式调用（vue 实例对象的创建过程）

vue实现链式调用其实是包含在 vue 实例对象的创建过程中，核心逻辑在 createAppAPI 函数中（通过 createBaseRenderer 方法调用的 createAppAPI）。

链式调用示例
```ts
import { createApp } from 'vue'

createApp({})
  .component('SearchInput', SearchInputComponent)
  .directive('focus', FocusDirective)
  .use(LocalePlugin)
  .mount('#app')
```

createAppAPI 实现链式调用的核心源码
```ts
// packages/runtime-core/src/apiCreateApp.ts
export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    
    // 当前 vue 实例的上下文，context.app 就是 vue 实例
    const context = createAppContext()

    let isMounted = false

    const app: App = (context.app = {
      _uid: uid++,
      _context: context,

      use(plugin: Plugin, ...options: any[]) {
        // ...
        return app
      },

      mixin(mixin: ComponentOptions) {
        // ...
        return app
      },

      component(name: string, component?: Component): any {
        // ...
        return app
      },

      directive(name: string, directive?: Directive) {
        // ...
        return app
      },

      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        isSVG?: boolean
      ): any {
        if (!isMounted) {
          // ...
          // mount 函数返回值 vnode component proxy
          return vnode.component!.proxy
        }
      },

      provide(key, value) {
        // ...
        return app
      }
    })

    return app
  }
}
```

我们可以看到 createAppAPI 返回 createApp 函数，createApp 方法的入参就是 全局 api createApp 的参数，在 createApp 方法创建了
app 对象，初始化了 app 属性和方法，**支持链式调用的 app 实例的方法中返回 app 对象本身**，这是链式调用的关键，
在 mount 函数调用后返回 vnode.component!.proxy，所以 mount 函数不支持链式调用（mount 表示 app 已成创建和挂载到容器，这里继续链式调用是没有意义的）。

**链式调用 demo**
```js
// 实现数字操作加减法链式调用
function operate(num) {
  num = num || 0
  Number.prototype.add = (x) => {
    num += x
    return num
  }
  Number.prototype.subtract = (x) => {
    num -= x
    return num
  }
  return num
}
```

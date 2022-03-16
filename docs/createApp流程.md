# createApp 流程解析

## createApp 做了什么事？

官网解释：
> 返回一个提供应用上下文的应用实例。应用实例挂载的整个组件树共享同一个上下文，可以在 createApp 之后链式调用其它方法。

个人理解总结：
1. 创建 vue 应用实例
2. 初始化应用上下文
3. 实现链式调用

### 创建 vue 应用实例

根据官网的解释，createApp 主要的作用就是创建 vue 应用实例，我们在下面对源码进行分析。

在 vue3 项目开发中，我们通常会在 `main.ts` 文件初始化全局 app 实例，下面是在一个 [vue3 项目](https://github.com/FBmm/vue3-vite-ts-pinia-naive) 初始应用的代码，
在调用 `createApp(App)` 初始化应用后，链式调用 use 方法添加 router、store、naive 等库，然后调用 `mount('#app')` 完成挂载，此时无法再继续链式调用。

```js
createApp(App)
  .use(router)
  .use(store)
  .use(naive)
  .mount('#app')
```

那么，我们调用 createApp(App) 后源码是怎么执行的呢？

先看一下 vue3 中 [createApp 的源码](packages/runtime-dom/src/index.ts)

### createApp 执行逻辑与源码分析

> createApp 是 runtime-dom 模块的 api  
> runtime-dom 模块：主要负责浏览器环境的渲染和 ssr 渲染。

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

在 vue3 createApp 方法的源码中，我们可以看通过 `const app = ensureRenderer().createApp(...args)`
返回 app 对象，并且重写了(对，这里是重写) app.mount 方法，然后返回了 app。
如此，创建 app 的核心代码是在 `ensureRenderer` 方法中。

下面我们看一下 `ensureRenderer` 方法的[源码](packages/runtime-dom/src/index.ts)，源码实现比较简单，这里调用`createRenderer`创建了 `renderer` 对象，
并且 `ensureRenderer` 方法是一个`惰性单利模式`的实现，renderer 对象只会初始化一次。
阅读后续的源码可以知道 ，renderer 是渲染相关非常核心的一个对象，它主要包括了 render 方法（就是大家都知道的 vue render 方法），和 createApp 的核心逻辑。

```ts
// packages/runtime-dom/src/index.ts
let renderer: Renderer<Element | ShadowRoot> | HydrationRenderer

function ensureRenderer(): Renderer<Element | ShadowRoot> {
  return (
    renderer ||
    (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  )
}
```

ensureRenderer 也是 runtime-dom 模块的方法，所以，renderer 对象主要负责浏览器平台的渲染，这里的 rendererOptions 参数保存了 dom 操作和dom 元素属性的 patch 操作。

> rendererOptions 是与平台相关的 dom 操作 api 的封装，因为 render 方法进行 diff 与渲染时会依赖平台 api。

接着我们看看 `createRenderer` 是怎么创建 renderer 对象的，先看看[源码](packages/runtime-dom/src/index.ts)

```ts
// packages/runtime-dom/src/index.ts
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options)
}
```

createRenderer 声明在 runtime-core 模块中，返回 `baseCreateRenderer<HostNode, HostElement>(options)` 方法调用后的返回值，
创建 renderer 对象的核心逻辑是在 baseCreateRenderer 函数中实现。

> runtime-core 模块：与平台无关的通用逻辑和运行时 api，包括了如 vue3 api、vnode、patch方法等

这里为什么创建 renderer 的逻辑不在 `createRenderer` 中实现？继续阅读源码我们可以发现，`baseCreateRenderer` 其实是一个重载函数，有两种重载形式：`overload 1: no hydration` 和 `overload 2: with hydration`。

```ts
// overload 1: no hydration
function baseCreateRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>): Renderer<HostElement>

// overload 2: with hydration
function baseCreateRenderer(
  options: RendererOptions<Node, Element>,
  createHydrationFns: typeof createHydrationFunctions
): HydrationRenderer
```

重载2 是在 `createSSRApp` 初始化服务端渲染应用时调用的，根据 `createHydrationFns` 参数处理 ssr 渲染的逻辑，ssr 渲染的逻辑这里暂时不展开讨论。

下面主要分析实现 `baseCreateRenderer` 方法的[源码](packages/runtime-core/src/renderer.ts)。baseCreateRenderer 函数主负责渲染器对象的核心实现，这个函数大约有 2000 行代码，主要是初始化 patch 方法、实现 patch 逻辑、初始化 render 方法、初始化了创建 vue 应用实例的函数等。
是在 runtime 阶段最核心的方法，后面需要单独对 patch 过程和 render 函数进行分析。这篇文章只是分析 `baseCreateRenderer` 的结构，patch 和 render 细节会单独进行分析。

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

### 实现链式调用

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

实现链式调用的核心源码

```ts
// packages/runtime-core/src/apiCreateApp.ts
export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
  /**
   * Vue app 实例就是这个函数创建的
   * 这个方法的参数就是 Vue 全局 api createApp 的参数
   */
  return function createApp(rootComponent, rootProps = null) {
    // 判断 rootProps 是不是对象类型
    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }

    // vue 实例的上下文对象
    const context = createAppContext()

    // 缓存已安装的 vue 插件
    const installedPlugins = new Set()

    // mounted 标志
    let isMounted = false

    // 创建 app 并且初始化 context.app
    const app: App = (context.app = {
      _uid: uid++,
      _component: rootComponent as ConcreteComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,

      version,

      // 拦截应用配置 app.config 取值操作 返回 context.config 数据
      get config() {
        return context.config
      },

      // 禁止 app.config 赋值，无法通过 app.config.xxx = xxx 修改 vue 应用配置
      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },

      // 注册插件
      use(plugin: Plugin, ...options: any[]) {
        if (installedPlugins.has(plugin)) { // 同一个插件上多次调用此方法时，该插件将仅安装一次
          __DEV__ && warn(`Plugin has already been applied to target app.`) // dev 环境警告
        } else if (plugin && isFunction(plugin.install)) { // 插件是对象，暴露 install 方法的情况
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) { // 插件本身是一个函数，则它将被视为 install 方法
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) { // dev 环境插件没有 install 方法警告
          warn(
            `A plugin must either be a function or an object with an "install" ` +
            `function.`
          )
        }
        return app
      },

      // mixin
      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          // vue 应用的 mixin 会已数组的形式保存在上下文环境
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
              (mixin.name ? `: ${mixin.name}` : '')
            )
          }
        } else if (__DEV__) {
          warn('Mixins are only available in builds supporting Options API')
        }
        return app
      },
      // 注册组件
      component(name: string, component?: Component): any {
        // dev 环境内置或保留组件名检测
        if (__DEV__) {
          validateComponentName(name, context.config)
        }
        // 如果不传 component 组件参数，返回已注册的组件定义
        if (!component) {
          return context.components[name]
        }
        // 已注册组件检测
        if (__DEV__ && context.components[name]) {
          warn(`Component "${name}" has already been registered in target app.`)
        }
        // vue 应用注册新组件
        context.components[name] = component
        return app
      },

      // 注册 app 指令，流程跟组件注册类似
      directive(name: string, directive?: Directive) {
        // 内置指令检测
        if (__DEV__) {
          validateDirectiveName(name)
        }

        if (!directive) {
          return context.directives[name] as any
        }
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        context.directives[name] = directive
        return app
      },

      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        isSVG?: boolean
      ): any {
        // 不能多次调用 mounted
        if (!isMounted) {
          // 创建新的vnode节点 在后面 render 方法中完成 diff 和渲染
          const vnode = createVNode(
            rootComponent as ConcreteComponent,
            rootProps
          )
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          // HMR root reload
          if (__DEV__) {
            context.reload = () => {
              render(cloneVNode(vnode), rootContainer, isSVG)
            }
          }

          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            render(vnode, rootContainer, isSVG) // 核心渲染 这里调用render方法进行diff和渲染
          }
          isMounted = true // 渲染完成
          app._container = rootContainer
          // for devtools and telemetry
          ;(rootContainer as any).__vue_app__ = app

          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = vnode.component
            devtoolsInitApp(app, version)
          }
          // mount 函数返回值 vnode component proxy
          return vnode.component!.proxy
        } else if (__DEV__) {
        }
      },

      unmount() {
        // 禁止卸载未渲染完成的组件
        if (isMounted) {
          render(null, app._container)
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = null
            devtoolsUnmountApp(app)
          }
          delete app._container.__vue_app__
        } else if (__DEV__) {
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },

      provide(key, value) {
        if (__DEV__ && (key as string | symbol) in context.provides) {
          warn(
            `App already provides property with key "${String(key)}". ` +
            `It will be overwritten with the new value.`
          )
        }
        // TypeScript doesn't allow symbols as index type
        // https://github.com/Microsoft/TypeScript/issues/24587
        context.provides[key as string] = value

        return app
      }
    })

    if (__COMPAT__) {
      installAppCompatProperties(app, context, render)
    }

    return app
  }
}
```

我们可以看到 createAppAPI 返回 createApp 函数，createApp 方法的入参就是 全局 api createApp 的参数，在 createApp 方法创建了
app 对象，初始化了 app 属性和方法，**支持链式调用的 app 实例的方法中返回 app 对象本身**，这是链式调用的关键，
在 mount 函数调用后返回 vnode.component!.proxy，所以 mount 函数不支持链式调用（mount 表示 app 已成创建和挂载到容器，这里继续链式调用是没有意义的）。

## 个人理解

### 初始化应用上下文

我对 `应用实例挂载的整个组件树共享同一个上下文` 的理解是在调用 createApp 时会创建应用和组件的上下文环境，这里的上下文并不只是一个或某个上下文环境，
比如每个组件都可以调用组件级的上下文环境和app级的上下文环境等，具体行为要通过源码进行分析。

### 链式调用 demo

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

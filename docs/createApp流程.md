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

那么如何理解官网的其他解释： `应用实例挂载的整个组件树共享同一个上下文`、`在 createApp 之后链式调用其它方法` 呢？我们继续从源码中找答案。

### 初始化应用上下文

我对 `应用实例挂载的整个组件树共享同一个上下文` 的理解是在调用 createApp 时会创建应用和组件的上下文环境，这里的上下文并不只是一个或某个上下文环境，
比如每个组件都可以调用组件级的上下文环境和app级的上下文环境等，具体行为要通过源码进行分析。

**我们先来看调用 ensureRenderer 函数的过程**

ensureRenderer 也是 runtime-dom 模块的方法，根据源码可以看出 ensureRenderer 函数主要是调用 createRenderer 初始化 renderer 对象或者返回缓存的 renderer，表示 renderer 对象只会初始化一次。
根据 renderer 对象的声明和后续源码可以知道，传入 rendererOptions（平台相关的配置参数） 调用 createRenderer 函数后，返回由 render 函数和 createApp 方法组成的对象，
所以 renderer 存在的目的就是初始化 render 和 createApp 具体实现方法，并且还负责 ssr 相关的渲染逻辑。或者可以说 renderer 主要负责平台渲染逻辑，平台由 rendererOptions 参数决定。

```ts
// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
// render 函数和 createApp 方法保存在这个对象
let renderer: Renderer<Element | ShadowRoot> | HydrationRenderer

function ensureRenderer(): Renderer<Element | ShadowRoot> {
  return (
    renderer ||
    (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  )
}
```


### 实现链式调用
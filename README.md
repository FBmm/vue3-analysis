# vue3-analysis
This is the repository for Vue 3.0 analysis.

## packages 目录结构

```shell
|-- packages
    |-- compiler-core     // 核心编译器
    |-- compiler-dom      // dom编译器
    |-- compiler-sfc      // vue单文件编译器
    |-- compiler-ssr      // 服务端渲染编译器
    |-- reactivity        // 响应式模块
    |-- runtime-core      // 运行时核心代码以及api
    |-- runtime-dom       // 运行时dom相关api
    |-- runtime-test      // 运行时测试代码
    |-- server-renderer   // 服务端渲染
    |-- sfc-playground    // 单文件在线调试
    |-- shared            // 内部工具库
    |-- size-check        // tree-shaking 后运行时代码体积测试
    |-- template-explorer
    |-- vue
    |-- vue-compat        // vue2.x 兼容
```

## 核心源码路径

runtime 相关
- [dom app - dom渲染器 renderer、ssr renderer 对象创建，createApp 方法实现](packages/runtime-dom/src/index.ts)
- [render、patch - 渲染器 renderer 工厂函数实现、初始化 render 函数、初始化 patch 方法](packages/runtime-core/src/renderer.ts)
- [vnode - VNode 类型声明、vnode 对象创建、block 优化等](packages/runtime-core/src/vnode.ts)
- [h函数实现](packages/runtime-core/src/h.ts)


import {
  ConcreteComponent,
  Data,
  validateComponentName,
  Component,
  ComponentInternalInstance
} from './component'
import {
  ComponentOptions,
  MergedComponentOptions,
  RuntimeCompilerOptions
} from './componentOptions'
import { ComponentPublicInstance } from './componentPublicInstance'
import { Directive, validateDirectiveName } from './directives'
import { RootRenderFunction } from './renderer'
import { InjectionKey } from './apiInject'
import { warn } from './warning'
import { createVNode, cloneVNode, VNode } from './vnode'
import { RootHydrateFunction } from './hydration'
import { devtoolsInitApp, devtoolsUnmountApp } from './devtools'
import { isFunction, NO, isObject } from '@vue/shared'
import { version } from '.'
import { installAppCompatProperties } from './compat/global'
import { NormalizedPropsOptions } from './componentProps'
import { ObjectEmitsOptions } from './componentEmits'

export interface App<HostElement = any> {
  version: string
  config: AppConfig
  use(plugin: Plugin, ...options: any[]): this
  mixin(mixin: ComponentOptions): this
  component(name: string): Component | undefined
  component(name: string, component: Component): this
  directive(name: string): Directive | undefined
  directive(name: string, directive: Directive): this
  mount(
    rootContainer: HostElement | string,
    isHydrate?: boolean,
    isSVG?: boolean
  ): ComponentPublicInstance
  unmount(): void
  provide<T>(key: InjectionKey<T> | string, value: T): this

  // internal, but we need to expose these for the server-renderer and devtools
  _uid: number
  _component: ConcreteComponent
  _props: Data | null
  _container: HostElement | null
  _context: AppContext
  _instance: ComponentInternalInstance | null

  /**
   * v2 compat only
   */
  filter?(name: string): Function | undefined
  filter?(name: string, filter: Function): this

  /**
   * @internal v3 compat only
   */
  _createRoot?(options: ComponentOptions): ComponentPublicInstance
}

export type OptionMergeFunction = (to: unknown, from: unknown) => any

export interface AppConfig {
  // @private
  readonly isNativeTag?: (tag: string) => boolean

  performance: boolean
  optionMergeStrategies: Record<string, OptionMergeFunction>
  globalProperties: Record<string, any>
  errorHandler?: (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentPublicInstance | null,
    trace: string
  ) => void

  /**
   * Options to pass to @vue/compiler-dom.
   * Only supported in runtime compiler build.
   */
  compilerOptions: RuntimeCompilerOptions

  /**
   * @deprecated use config.compilerOptions.isCustomElement
   */
  isCustomElement?: (tag: string) => boolean

  /**
   * Temporary config for opt-in to unwrap injected refs.
   * TODO deprecate in 3.3
   */
  unwrapInjectedRef?: boolean
}

export interface AppContext {
  app: App // for devtools
  config: AppConfig
  mixins: ComponentOptions[]
  components: Record<string, Component>
  directives: Record<string, Directive>
  provides: Record<string | symbol, any>

  /**
   * Cache for merged/normalized component options
   * Each app instance has its own cache because app-level global mixins and
   * optionMergeStrategies can affect merge behavior.
   * @internal
   */
  optionsCache: WeakMap<ComponentOptions, MergedComponentOptions>
  /**
   * Cache for normalized props options
   * @internal
   */
  propsCache: WeakMap<ConcreteComponent, NormalizedPropsOptions>
  /**
   * Cache for normalized emits options
   * @internal
   */
  emitsCache: WeakMap<ConcreteComponent, ObjectEmitsOptions | null>
  /**
   * HMR only
   * @internal
   */
  reload?: () => void
  /**
   * v2 compat only
   * @internal
   */
  filters?: Record<string, Function>
}

type PluginInstallFunction = (app: App, ...options: any[]) => any

export type Plugin =
  | (PluginInstallFunction & { install?: PluginInstallFunction })
  | {
      install: PluginInstallFunction
    }

export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      // 设置为 true 以在浏览器开发工具的 performance/timeline 面板中启用对组件初始化、编译、渲染和更新的性能追踪。
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      // 运行时编译器的选项
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap()
  }
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null
) => App<HostElement>

let uid = 0

// vue createApp api
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
          warn(
            `App has already been mounted.\n` +
            `If you want to remount the same app, move your app creation logic ` +
            `into a factory function and create fresh app instances for each ` +
            `mount - e.g. \`const createMyApp = () => createApp(App)\``
          )
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

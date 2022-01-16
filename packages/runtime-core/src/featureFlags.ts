import { getGlobalThis } from '@vue/shared'

/**
 * This is only called in esm-bundler builds.
 * It is called when a renderer is created, in `baseCreateRenderer` so that
 * importing runtime-core is side-effects free.
 *
 * istanbul-ignore-next
 *
 * 仅在 esm bundler 构建调用。renderer 被创建时调用以便导入的 runtime-core 没有副作用
 */
export function initFeatureFlags() {
  let needWarn = false

  if (typeof __FEATURE_OPTIONS_API__ !== 'boolean') {
    needWarn = true
    getGlobalThis().__VUE_OPTIONS_API__ = true
  }

  if (typeof __FEATURE_PROD_DEVTOOLS__ !== 'boolean') {
    needWarn = true
    getGlobalThis().__VUE_PROD_DEVTOOLS__ = false
  }

  if (__DEV__ && needWarn) {
    console.warn(
      `You are running the esm-bundler build of Vue. It is recommended to ` +
        `configure your bundler to explicitly replace feature flag globals ` +
        `with boolean literals to get proper tree-shaking in the final bundle. ` +
        `See http://link.vuejs.org/feature-flags for more details.`
    )
  }
}

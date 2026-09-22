/*
 * 参数列表的唯一持有者。对外只给动作、list() 给的是拷贝：把内部数组的引用发出去，
 * 各处就会就地 splice，而「这个数组的身份不能换」这条约束在任何签名里都读不出来
 */

/** 参数项：{ key, defaultValue, isNew } */
export function createParamsStore() {
  let params = [];

  const clone = (param) => ({ ...param });

  return {
    list() {
      return params.map(clone);
    },

    count() {
      return params.length;
    },

    hasKey(key) {
      return params.some((param) => param.key === key);
    },

    replaceAll(nextParams) {
      params = nextParams.map(clone);
    },

    /** 用当前 URL 上的参数补齐列表，已在列表里的键跳过 */
    appendMissingKeys(keys, options) {
      const { isNew } = options;
      for (const key of keys) {
        if (!this.hasKey(key)) {
          params.push({ key, defaultValue: null, isNew });
        }
      }
    },

    insertFirst(param) {
      params.unshift(clone(param));
    },

    removeAt(index) {
      params.splice(index, 1);
    },

    /** 返回是否真的移动了：目标位置越界或与原位置相同都算没动 */
    move(fromIndex, toIndex) {
      if (fromIndex === toIndex || toIndex < 0 || toIndex >= params.length) {
        return false;
      }
      const [moved] = params.splice(fromIndex, 1);
      params.splice(toIndex, 0, moved);
      return true;
    },

    /** 返回默认值是否真的变了 */
    setDefaultValue(index, defaultValue) {
      if (params[index].defaultValue === defaultValue) {
        return false;
      }
      params[index].defaultValue = defaultValue;
      return true;
    },

    /** 保存成功后清掉「新」标记 */
    markAllSaved() {
      params = params.map((param) => ({ ...param, isNew: false }));
    },
  };
}

/** Poly Haven HDRI 分类英文 → 中文 */
export const CATEGORY_ZH = {
  outdoor: '户外',
  indoor: '室内',
  nature: '自然',
  urban: '城市',
  skies: '天空',
  studio: '摄影棚',
  night: '夜晚',
  clear: '晴朗',
  overcast: '阴天',
  'partly cloudy': '局部多云',
  'low contrast': '低对比度',
  'medium contrast': '中等对比度',
  'high contrast': '高对比度',
  'natural light': '自然光',
  'artificial light': '人工光',
  'morning-afternoon': '晨/午后',
  'sunrise-sunset': '日出/日落',
  midday: '正午',
};

export function categoryLabel(en) {
  return CATEGORY_ZH[en] ?? en;
}

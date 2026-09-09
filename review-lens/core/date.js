/** 只取日期部分：读评审时「哪一天说的」够用，精确到分秒反而占地方 */
export const asDate = (iso) => String(iso ?? "").slice(0, 10);

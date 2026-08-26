/**
 * 预置题库 EXAM_QUESTIONS
 *
 * M1 阶段仅含种子数据（少量真题），用于走通端到端骨架；
 * 全量题库在 M2 阶段用 agent-browser 抓取 CSDN + 阿里云课程后填充。
 *
 * 结构（architecture.md §4.2）：
 *   { id:number, type:"single"|"multi", title:string,
 *     options:{key,text}[], answer:string[], explain:string }
 *
 * UMD 包装（TD-2）：浏览器作为普通脚本加载时挂到全局；Node/Vitest 下可 require/import。
 */
(function (global) {
  "use strict";

  const EXAM_QUESTIONS = [
    {
      id: 1,
      type: "multi",
      title:
        "关于多线程并行处理定时任务的情况，下列哪些说法符合《阿里巴巴Java开发手册》：",
      options: [
        { key: "A", text: "推荐使用Timer方式处理。" },
        { key: "B", text: "推荐使用ScheduledExecutorService方式处理。" },
        {
          key: "C",
          text: "Timer运行多个TimeTask时，只要其中之一没有捕获抛出的异常，其它任务便会自动终止运行。",
        },
        {
          key: "D",
          text: "ScheduledExecutorService并发运行多个定时任务时，其中某线程抛出异常，不会影响到其它线程的继续运行。",
        },
      ],
      answer: ["B", "C", "D"],
      explain:
        "Timer 运行多个 TimeTask 时，一个未捕获异常会终止所有任务；ScheduledExecutorService 线程间互不影响，故推荐后者。",
    },
    {
      id: 2,
      type: "single",
      title:
        "KV结构的集合，在处理null值的存储上有细微的区别，下列哪个说法是正确的：",
      options: [
        { key: "A", text: "TreeMap的key不可以为null" },
        { key: "B", text: "TreeMap的key可以为null" },
        { key: "C", text: "ConcurrentHashMap的key可以为null" },
        { key: "D", text: "HashMap的key不可以为null" },
      ],
      answer: ["A"],
      explain:
        "TreeMap 按 key 排序，null 无法比较，故 key 不可为 null；ConcurrentHashMap 的 key/value 均不可为 null；HashMap 的 key 允许一个 null。",
    },
    {
      id: 3,
      type: "multi",
      title:
        "关于SimpleDateFormat的线程安全问题，下列哪些说法是正确的：",
      options: [
        { key: "A", text: "SimpleDateFormat 是线程不安全的类" },
        { key: "B", text: "SimpleDateFormat 可以随意定义为 static 共享" },
        {
          key: "C",
          text: "如果定义为 static，必须加锁或使用 ThreadLocal 保证线程安全",
        },
        { key: "D", text: "推荐使用 Apache 的 DateUtils 等线程安全工具" },
      ],
      answer: ["A", "C", "D"],
      explain:
        "SimpleDateFormat 线程不安全；定义为 static 时须保证线程安全（加锁 / ThreadLocal）；推荐使用线程安全的 DateUtils。",
    },
    {
      id: 4,
      type: "single",
      title:
        "下列关于 Java 异常处理的说法，符合《阿里巴巴Java开发手册》的是：",
      options: [
        { key: "A", text: "可以用 catch 捕获异常来做流程控制、条件控制" },
        { key: "B", text: "不要捕获 Throwable 而应捕获具体异常，且不要吞掉异常" },
        { key: "C", text: "finally 块中可以使用 return 语句" },
        { key: "D", text: "catch 块中可以为空，不做任何处理" },
      ],
      answer: ["B"],
      explain:
        "异常不应用于流程控制；应捕获具体异常且不吞异常；finally 中禁止 return；catch 不应为空吞掉异常。",
    },
  ];

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { EXAM_QUESTIONS };
  } else {
    global.EXAM_QUESTIONS = EXAM_QUESTIONS;
  }
})(typeof self !== "undefined" ? self : this);

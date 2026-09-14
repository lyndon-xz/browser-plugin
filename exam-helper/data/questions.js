/**
 * 预置题库。按归一化题干去重，答案取自原文（含订正）。
 *
 * { id, type: "single"|"multi", title, options: [{key,text}], answer, explain }
 *
 * explain：手册【强制】/【推荐】原文摘要；由 materials/*.txt 规则片段匹配补全，可人工微调。
 */
export const EXAM_QUESTIONS = [
  {
    id: 1,
    type: "multi",
    title:
      "关于多线程并行处理定时任务的情况，下列哪些说法符合《阿里巴巴Java开发手册》",
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
      "【强制】多线程并行处理定时任务时，Timer 运行多个 TimeTask 时，只要其中之一没有捕获抛出的异 常，其它任务便会自动终止运行，使用 ScheduledExecutorService 则没有这个问题。",
  },
  {
    id: 2,
    type: "multi",
    title: "关于数据库中表相关的命名，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "表名、字段名禁止出现数字开头，禁止两个下划线中间只出现数字。",
      },
      { key: "B", text: "表名不使用复数名词。" },
      { key: "C", text: "表必备三字段命名：id, gmt_create, gmt_modify。" },
      { key: "D", text: "表必备三字段命名：id, gmt_create, gmt_modified。" },
    ],
    answer: ["A", "B", "D"],
    explain: "【强制】表名不使用复数名词。",
  },
  {
    id: 3,
    type: "single",
    title:
      "KV结构的集合，在处理null值的存储上有细微的区别，下列哪些说法是正确的",
    options: [
      { key: "A", text: "TreeMap的key不可以为null" },
      { key: "B", text: "TreeMap的key可以为null" },
      { key: "C", text: "ConcurrentHashMap的key可以为null" },
      { key: "D", text: "ConcurrentHashMap的value可以为null" },
    ],
    answer: ["A"],
    explain:
      "HashMap的key/value均可以为null，但是TreeMap的key不能为空，value可以为空",
  },
  {
    id: 4,
    type: "multi",
    title: "关于二方库依赖的解析命令，下列哪些说法是正确的",
    options: [
      { key: "A", text: "mvn dependency:resolve 打印出已仲裁依赖的列表。" },
      { key: "B", text: "mvn dependency:tree 打印工程整个的依赖树结构。" },
      {
        key: "C",
        text: "mvn dependency:tree -Dverbose -Dincludes=commons-lang 打印出与commons-lang相关的详细依赖。",
      },
      {
        key: "D",
        text: "mvn clean install 打印工程整个的依赖树结构，并部署到本地仓库中。",
      },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【强制】二方库的新增或升级，保持除功能点之外的其它 jar 包仲裁结果不变。",
  },
  {
    id: 5,
    type: "multi",
    title: "关于变量和常量定义，下列哪些符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "Long a=2L；//大写的L" },
      { key: "B", text: "Long a=2l; //小写的l" },
      { key: "C", text: "常量只定义一次，不再赋值，所以不需要命名规范。" },
      {
        key: "D",
        text: "不要使用一个常量类维护所有常量，应该按常量功能进行归类，分开维护。",
      },
    ],
    answer: ["A", "D"],
    explain:
      "【推荐】不要使用一个常量类维护所有常量，要按常量功能进行归类，分开维护。",
  },
  {
    id: 6,
    type: "multi",
    title: "关于线程安全，下列哪些说法是正确的",
    options: [
      { key: "A", text: "SimpleDateFormat 是线程不安全的类。" },
      { key: "B", text: "SimpleDateFormat 是线程安全的类。" },
      {
        key: "C",
        text: "一般不要定义SimpleDateFormat的static变量，如果定义为static，必须保证线程安全。",
      },
      {
        key: "D",
        text: "推荐使用Apache封装好的DateUtils和DateFormatUtils工具类，来处理时间日期转换问题。",
      },
    ],
    answer: ["A", "C", "D"],
    explain:
      "【强制】SimpleDateFormat 是线程不安全的类，一般不要定义为 static 变量，如果定义为 static，必须 加锁，或者使用 DateUtils 工具类。",
  },
  {
    id: 7,
    type: "multi",
    title: "以下关于格式规约的说法，正确的有哪些",
    options: [
      {
        key: "A",
        text: "代码块缩进4个空格，如果使用tab缩进，请设置成1个tab为4个空格；",
      },
      {
        key: "B",
        text: "代码块缩进5个空格，如果使用tab缩进，请设置成1个tab为5个空格。",
      },
      {
        key: "C",
        text: "为了保持代码美观，《手册》强烈推荐增加若干空格，使某一行的变量与相邻对应位置的变量对齐。",
      },
      {
        key: "D",
        text: "方法体内的执行语句组、变量的定义语句组、不同的业务逻辑之间或者不同的语义之间推荐插入一个空行；",
      },
    ],
    answer: ["A", "D"],
    explain:
      "【推荐】不同逻辑、不同语义、不同业务的代码之间插入一个空行，分隔开来以提升可读性。",
  },
  {
    id: 8,
    type: "multi",
    title: "数组使用Arrays.asList转化为集合，下列说法哪些正确的",
    options: [
      { key: "A", text: "数组元素的修改，会影响到转化过来的集合。" },
      { key: "B", text: "数组元素的修改，不会影响到转化过来的集合。" },
      {
        key: "C",
        text: "对于转换过来的集合，它的 add/remove/clear 方法会抛出: UnsupportedOperationException。",
      },
      {
        key: "D",
        text: "Arrays.asList 体现的是适配器模式，只是转换接口，后台的数据仍是数组。",
      },
    ],
    answer: ["A", "C", "D"],
    explain:
      "【强制】使用工具类 Arrays.asList() 把数组转换成集合时，不能使用其修改集合相关的方法，它的 add / remove / clear 方法会抛出 UnsupportedOperationException 异常。",
  },
  {
    id: 9,
    type: "multi",
    title: "关于异常的处理方式，下列哪些说法是正确的",
    options: [
      {
        key: "A",
        text: "为防止obj对象本身空指针异常，书写代码时应该注意加异常捕获处理，例如：try { obj.method() } catch(NullPointerException e){……} 。",
      },
      { key: "B", text: "方法签名中，抛给调用者的关键字为throws" },
      { key: "C", text: "方法内部，抛出异常实例对象为throws" },
      {
        key: "D",
        text: "自定义异常要做到“认知对等”，即：抛出者和接收者要保持对自定义异常的认知统一，接收方需要知道这种异常的含义和对应的处理方案。",
      },
    ],
    answer: ["B", "D"],
    explain:
      "【强制】Java 类库中定义的可以通过预检查方式规避的 RuntimeException 异常不应该通过",
  },
  {
    id: 10,
    type: "multi",
    title:
      "Hashtable，HashMap, ConcurrentHashMap都是Map的实现类，它们在处理null值的存储上有细微的区别，下列哪些说法是正确的",
    options: [
      { key: "A", text: "Hashtable的KV都不可以为null。" },
      { key: "B", text: "HashMap的KV都可以为null。" },
      { key: "C", text: "HashMap的K不可以为null，V可以为null。" },
      { key: "D", text: "ConcurrentHashMap的KV都不可以为null。" },
    ],
    answer: ["A", "B", "D"],
    explain: "HashMap kv都可以为null，",
  },
  {
    id: 11,
    type: "single",
    title: "关于测试代码的覆盖率，下列哪些说法是正确的？",
    options: [
      {
        key: "A",
        text: "路径覆盖是最强覆盖，符合路径覆盖且测试全部通过，程序绝对没有问题。",
      },
      { key: "B", text: "语句覆盖度是最弱的覆盖度量方式。" },
      { key: "C", text: "分支覆盖与条件覆盖其实是一回事。" },
      { key: "D", text: "判定条件覆盖与路径覆盖其实是一回事。" },
    ],
    answer: ["B"],
    explain:
      "【推荐】单测的基本目标：语句覆盖率达到 70%；核心模块的语句覆盖率和分支覆盖率都要达到 100%。",
  },
  {
    id: 12,
    type: "multi",
    title: "关于checked/unchecked exception，下列哪些说法是正确的",
    options: [
      { key: "A", text: "继承java.lang.Error的类属于checked exception。" },
      { key: "B", text: "checked异常继承java.lang.Exception类。" },
      { key: "C", text: "unchecked异常继承java.lang.RuntimeException类。" },
      {
        key: "D",
        text: "NullPointerException , IllegalArgumentException属于unchecked exception。",
      },
    ],
    answer: ["B", "C", "D"],
    explain:
      "【推荐】定义时区分 unchecked / checked 异常，避免直接抛出 new RuntimeException()，更不允许 抛出 Exception 或者 Throwable，应使用有业务含义的自定义异常。",
  },
  {
    id: 13,
    type: "multi",
    title: "以下关于命名规约内容说明，正确的是",
    options: [
      {
        key: "A",
        text: "【强制】包名统一使用小写，点分隔符之间有且仅有一个自然语义的英语单词，并且使用复数形式，例如：应用工具类包名为com.alibaba.mpp.utils",
      },
      {
        key: "B",
        text: "【强制】类名使用UpperCamelCase，必须遵从驼峰形式，但以下情形例外：（领域模型的相关命名）DO / DTO / VO / DAO等。",
      },
      {
        key: "C",
        text: "【强制】抽象类命名使用Abstract或Base开头；异常类命名使用Exception结尾；测试类命名以它要测试的类的名称开始，以Test结尾。",
      },
      {
        key: "D",
        text: "【强制】枚举类名建议带上Enum后缀，枚举成员名称需要全大写，单词间用下划线隔开。",
      },
      {
        key: "E",
        text: "如果使用到了设计模式，建议在类名中体现出具体模式。例如代理模式的类命名：LoginProxy；观察者模式命名：ResourceObserver。",
      },
    ],
    answer: ["B", "C", "D", "E"],
    explain: "【强制】抽象类命名使用 Abstract 或 Base 开头；",
  },
  {
    id: 14,
    type: "multi",
    title: "关于MySQL性能优化的描述，下列哪些说法是正确的",
    options: [
      { key: "A", text: "主键查询优先于二级索引查询。" },
      { key: "B", text: "表连接有一定的代价，故表连接数量越少越好。" },
      { key: "C", text: "一般情况下，二级索引扫描优先于全表扫描。" },
      { key: "D", text: "可以使用通过索引避免排序代价。" },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【强制】超过三个表禁止 join。多表关联查询时，保证被关联的字段需要有索引。5.【推荐】利用覆盖索引来进行查询操作，避免回表。",
  },
  {
    id: 15,
    type: "multi",
    title: "关于生产环境的日志文件，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "异常信息应该包括两类信息：案发现场信息和异常堆栈信息。",
      },
      {
        key: "B",
        text: "日志文件推荐至少保存15天，因为有些异常具备以“周”为频次发生的特点。",
      },
      {
        key: "C",
        text: "避免重复打印日志，浪费磁盘空间，务必在log4j.xml中设置additivity=false。",
      },
      { key: "D", text: "错误日志和业务日志尽量分开存放。" },
    ],
    answer: ["A", "B", "C", "D"],
    explain: "【强制】异常信息应该包括两类信息：案发现场信息和异常堆栈信息。",
  },
  {
    id: 16,
    type: "multi",
    title: "关于索引的使用，下列哪些说法是正确的",
    options: [
      { key: "A", text: "查询语句 WHERE a+1 = 5 可以利用a索引。" },
      {
        key: "B",
        text: "查询语句WHERE date_format(gmt_create, ‘%Y-%m-%d’) = '2016-11-11’无法利用gmt_create索引。",
      },
      {
        key: "C",
        text: "当 c 列类型为 char 时，查询语句 WHERE c = 5 无法利用c索引。",
      },
      { key: "D", text: "索引字段使用时不能进行函数运算。" },
    ],
    answer: ["B", "C", "D"],
    explain: "【强制】如果存储的字符串长度几乎相等，使用 char 定长字符串类型。",
  },
  {
    id: 17,
    type: "multi",
    title: "关于索引的设计，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "对varchar类型的字段建立索引，必须指定索引长度。" },
      {
        key: "B",
        text: "对varchar类型的字段建立索引，不需要指定索引长度，这样索引区分度最好。",
      },
      {
        key: "C",
        text: "业务上具有唯一特性的字段（含组合字段），必须指定唯一索引。",
      },
      { key: "D", text: "建复合索引时，一般选择区分度高的字段放在最左列。" },
    ],
    answer: ["A", "C", "D"],
    explain:
      "【强制】业务上具有唯一特性的字段，即使是组合字段，也必须建成唯一索引。",
  },
  {
    id: 18,
    type: "multi",
    title: "关于Java的接口描述，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "在接口类中的方法和属性使用public修饰符。" },
      {
        key: "B",
        text: "对于Service类，内部的实现类加Impl的后缀与接口区别。例如：ProductServiceImpl实现ProductService接口。",
      },
      {
        key: "C",
        text: "对于Service类，基于SOA的理念，是以接口方式暴露服务。",
      },
      {
        key: "D",
        text: "尽量不在接口里定义变量，如果一定要定义变量，肯定是与接口方法相关，而且是整个应用的基础常量。",
      },
    ],
    answer: ["B", "C", "D"],
    explain:
      "【推荐】接口类中的方法和属性不要加任何修饰符号（public 也不要加），保持代码的简洁性，并加上 有效的 Javadoc 注释。",
  },
  {
    id: 19,
    type: "single",
    title: "关于类的序列化，下列说法哪些是正确的",
    options: [
      { key: "A", text: "类的序列化与serialVersionUID毫无关系。" },
      { key: "B", text: "如果完全不兼容升级，不需要修改serialVersionUID值。" },
      { key: "C", text: "POJO类的serialVersionUID不一致会编译出错。" },
      {
        key: "D",
        text: "POJO类的serialVersionUID不一致会抛出序列化运行时异常。",
      },
    ],
    answer: ["D"],
    explain:
      "【强制】序列化类新增属性时，请不要修改 serialVersionUID 字段，避免反序列失败；",
  },
  {
    id: 20,
    type: "multi",
    title:
      "关于接口使用抛异常还是返回错误码，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "向公司外部提供的http/api接口，推荐使用“错误码”方式返回异常或者错误信息。",
      },
      {
        key: "B",
        text: "对于应用内部的方法调用，推荐使用“抛出异常”的方式处理异常或者错误信息。",
      },
      {
        key: "C",
        text: "跨应用的RPC调用，推荐使用将“错误码”和“错误简短信息”封装成Result的方式进行返回。",
      },
      {
        key: "D",
        text: "对外提供的接口，一定要保证逻辑健壮性：尽量避免空指针等技术类异常；对于业务类异常要做好错误码或者异常信息的封装。",
      },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【参考】对于公司外的 http / api 开放接口必须使用错误码，而应用内部推荐异常抛出；",
  },
  {
    id: 21,
    type: "multi",
    title: "根据《阿里巴巴Java开发手册》，以下功能必须进行水平权限控制校验的有",
    options: [
      { key: "A", text: "订单详情页面。" },
      { key: "B", text: "类目管理后台。" },
      { key: "C", text: "店铺装修后台。" },
      { key: "D", text: "订单付款页面。" },
    ],
    answer: ["A", "B", "C", "D"],
    explain: "【强制】隶属于用户个人的页面或者功能必须进行权限控制校验。",
  },
  {
    id: 22,
    type: "multi",
    title: "关于分页查询，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "分页查询，当统计的count为0时，应该直接返回，不要再执行分页查询语句。",
      },
      {
        key: "B",
        text: "iBATIS自带的queryForList(String statementName,int start,int size)分页接口有性能隐患，不允许使用。",
      },
      {
        key: "C",
        text: "定义明确的sql查询语句，通过传入参数start和size来实现分页逻辑。",
      },
      { key: "D", text: "可使用存储过程写分页逻辑，提高效率。" },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【强制】代码中写分页查询逻辑时，若 count 为 0 应直接返回，避免执行后面的分页语句。",
  },
  {
    id: 23,
    type: "multi",
    title:
      "关于Java代码的设计和开发注意事项，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "所有的覆写方法，必须是强制加 @Override。" },
      {
        key: "B",
        text: "setter方法中，参数名称与类成员变量名称一致，this.成员名=参数名。",
      },
      {
        key: "C",
        text: "在getter方法中，尽量不要增加逻辑判断，因为添加了逻辑判断后，会增加排查问题难度。",
      },
      { key: "D", text: "避免用BeanUtil进行属性的copy。" },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【推荐】setter 方法中，参数名称与类成员变量名称一致，this.成员名=参数名。",
  },
  {
    id: 24,
    type: "multi",
    title: "在多线程并发读写的情况下，下列哪些处理方式能保证对象的线程安全",
    options: [
      { key: "A", text: "使用volatile关键字。" },
      { key: "B", text: "使用synchronized关键字给对象的读写操作加锁。" },
      {
        key: "C",
        text: "如果是基本类型，推荐使用java.util.concurrent.atomic包下面提供的线程安全的基本类型包装类，例如AtomicInteger。",
      },
      {
        key: "D",
        text: "如果是集合，推荐使用java.util.concurrent提供的并发集合类，例如：ConcurrentHashMap。",
      },
    ],
    answer: ["B", "C", "D"],
    explain:
      "【参考】volatile 解决多线程内存不可见问题对于一写多读，是可以解决变量同步问题，但是如果多 写，同样无法解决线程安全问题。",
  },
  {
    id: 25,
    type: "multi",
    title: "关于代码书写格式，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "换行时相对上一行缩进2个空格。" },
      {
        key: "B",
        text: "运算符与下文一起换行，方法调用的点符号与下文一起换行。   .append()",
      },
      { key: "C", text: "在多个参数超长，逗号后进行换行。" },
      { key: "D", text: "在括号前不要换行。" },
    ],
    answer: ["B", "C", "D"],
    explain:
      "【强制】单行字符数限制不超过 120 个，超出需要换行，换行时遵循如下原则： 1）第二行相对第一行缩进 4 个空格，从第三行开始，不再继续缩进，参考示例。",
  },
  {
    id: 26,
    type: "single",
    title:
      "关于使用explain对数据库性能进行优化分析，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "SQL性能优化的目标：至少要达到 range 级别，要求是ref级别，如果可以是consts最好。",
      },
      { key: "B", text: "index级别走的是扫描索引，所以速度会比ref快。" },
      { key: "C", text: "range级别是指对表进行范围索引。" },
      { key: "D", text: "ref级别是指使用主键或者唯一索引。" },
    ],
    answer: ["A"],
    explain:
      "【推荐】SQL 性能优化的目标：至少要达到 range 级别，要求是 ref 级别，如果可以是 const 最好。",
  },
  {
    id: 27,
    type: "multi",
    title: "关于索引效率，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "使用索引的效率一定高于全表扫描的效率。" },
      {
        key: "B",
        text: "关于explain的结果，type=index的索引效率好于type=ref。",
      },
      { key: "C", text: "sql查询条件 where a like ‘%阿里%’ ，不会走索引。" },
      {
        key: "D",
        text: "sql查询条件 where a like ‘阿里%’ ,a列创建了索引，一般会使用索引进行检索。",
      },
    ],
    answer: ["C", "D"],
    explain:
      "【强制】用户输入的 SQL 参数严格使用参数绑定或者 METADATA 字段值限定，防止 SQL 注入，禁止字 符串拼接 SQL 访问数据库。",
  },
  {
    id: 28,
    type: "multi",
    title: "关于线程池管理线程的好处，下列哪些说法是正确的",
    options: [
      {
        key: "A",
        text: "能够减少在创建和销毁线程上所花的时间以及系统资源的开销。",
      },
      { key: "B", text: "使用线程池一定能避免OOM问题。" },
      {
        key: "C",
        text: "线程资源必须通过线程池提供，不允许在应用中自行显式创建线程。",
      },
      {
        key: "D",
        text: "线程池能够根据资源等待情况，自动调整线程优先级并解决死锁问题。",
      },
    ],
    answer: ["A", "C"],
    explain:
      "【强制】线程资源必须通过线程池提供，不允许在应用中自行显式创建线程。",
  },
  {
    id: 29,
    type: "multi",
    title: "关于用日志记录异常信息，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "日志尽量记录案发现场信息和异常堆栈信息。" },
      {
        key: "B",
        text: "如果日志中输出POJO类，POJO类需要重写toString方法，避免只输出hashCode。",
      },
      { key: "C", text: "不建议输出任何日志，因为日志记录消耗性能。" },
      { key: "D", text: "捕获异常后，一律抛给调用者去处理。" },
    ],
    answer: ["A", "B"],
    explain: "注意，子线程抛出异常堆栈，不能在主线程 try-catch 到",
  },
  {
    id: 30,
    type: "multi",
    title: "关于ORM的规则，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "数据库中，表达是与否概念的字段，必须使用is_xxx的方式命名。",
      },
      {
        key: "B",
        text: "推荐使用iBATIS自带的queryForList(String statementName,int start,int size)进行分页查询。(不推荐)",
      },
      {
        key: "C",
        text: "为避免写resultMap，可以直接拿HashMap与HashTable作为查询结果集的输出。",
      },
      {
        key: "D",
        text: "不要用resultClass当返回参数，即使所有类属性名与数据库字段一一对应，也需要定义。",
      },
    ],
    answer: ["A", "D"],
    explain:
      "【强制】不要用 resultClass 当返回参数，即使所有类属性名与数据库字段一一对应，也需要定义 <resultMap>；",
  },
  {
    id: 31,
    type: "multi",
    title: "关于注释，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "方法头定义签名上的注释可以使用//（双划线）简单说明，不必要遵守javadoc规范。（/** */）",
      },
      {
        key: "B",
        text: "类定义开始部分，一般都用Javadoc注释 程序的总体描述以及作者信息。",
      },
      {
        key: "C",
        text: "方法头定义签名上的注释必须遵守javadoc规范，使用/**回车来生成，不得在方法定义上方使用//（双划线）简单说明。",
      },
      { key: "D", text: "方法头定义签名上的注释，可以使用// xxx 的形式" },
    ],
    answer: ["B", "C"],
    explain:
      "【强制】类、类属性、类方法的注释必须使用 Javadoc 规范，使用 /** 内容 */ 格式，不得使用 // xxx 方式。",
  },
  {
    id: 32,
    type: "multi",
    title: "关于常量的命名，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "常量命名应该全部大写，单词间用下划线隔开。" },
      {
        key: "B",
        text: "常量的定义要力求语义表达完整清楚，让别人能从常量名称上大致了解含义，例如：MAX_STOCK_COUNT。",
      },
      { key: "C", text: "常量命名，可以使用拼音与英文的混合方式。" },
      { key: "D", text: "在使用缩写时要注意：杜绝不规范的缩写。" },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】常量命名应该全部大写，单词间用下划线隔开，力求语义表达完整清楚，不要嫌名字长。",
  },
  {
    id: 33,
    type: "multi",
    title: "关于二方库使用枚举类型，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "二方库里可以定义。" },
      { key: "B", text: "二方库里接口的入参可以使用枚举类型。" },
      {
        key: "C",
        text: "二方库里接口的返回值不能使用枚举类型，但可以包含枚举类型。",
      },
      {
        key: "D",
        text: "二方库里接口的返回值是枚举类型或包含枚举类型时，当二方库的枚举值升级（增加枚举值）时，可能会导致接口调用时出现枚举对象序列化异常。",
      },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】二方库里可以定义枚举类型，参数可以使用枚举类型，但是接口返回值不允许使用枚举类型或者 包含枚举类型的 POJO 对象。",
  },
  {
    id: 34,
    type: "multi",
    title: "关于hashcode和equals，下列哪些说法是正确的",
    options: [
      { key: "A", text: "hashcode是Class的方法，equals是Object的方法。" },
      {
        key: "B",
        text: "hashcode决定（如：HashMap）存储位置；equals决定是否需要覆盖（同一hash下）集合元素。",
      },
      { key: "C", text: "类重写hashcode，必须重写equals。" },
      { key: "D", text: "两者是否需要重写，没有必然联系。" },
    ],
    answer: ["B", "C"],
    explain: "equals 为true，hashcode值相同",
  },
  {
    id: 35,
    type: "multi",
    title: "关于常量定义，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "跨应用共享常量：放置在二方库中，通常是client.jar中的const目录下。",
      },
      {
        key: "B",
        text: "应用内共享常量：通常放置在一方库的子模块中的const目录下。",
      },
      { key: "C", text: "子工程内部共享常量：即在当前子工程的const目录下。" },
      { key: "D", text: "类内常量：直接在类内部private static final定义。" },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【推荐】常量的复用层次有五层：跨应用共享常量、应用内共享常量、子工程内共享常量、包内共享常 量、类内共享常量。",
  },
  {
    id: 36,
    type: "multi",
    title: "针对tcp协议，下列哪些说法是正确的",
    options: [
      {
        key: "A",
        text: "tcp链接主动关闭的一方，在完成四次挥手协议后，即会立即关闭并释放socket。",
      },
      {
        key: "B",
        text: "处于time_wait状态的socket，其实是已经关闭状态，当需要新建连接时，可以被马上复用。",
      },
      {
        key: "C",
        text: "当大量socket处于time_wait状态时，会导致可用socket资源稀缺，从而导致服务器并发能力下降。",
      },
      {
        key: "D",
        text: "通过修改/etc/sysctl.conf配置文件，减小time_wait的超时时间，可以降低time_wait状态的socket数量，从而提升服务器并发能力。",
      },
    ],
    answer: ["C", "D"],
    explain: "【推荐】高并发服务器建议调小 TCP 协议的 time_wait 超时时间。",
  },
  {
    id: 37,
    type: "multi",
    title: "关于try-catch的使用方式，下列哪些说法是正确的",
    options: [
      { key: "A", text: "推荐用try-catch来做流程控制、条件控制。" },
      {
        key: "B",
        text: "捕获异常与抛异常，必须是完全匹配，或者捕获异常是抛异常的父类。",
      },
      {
        key: "C",
        text: "对大段代码进行try-catch，利用Throwable来捕捉，万无一失。",
      },
      {
        key: "D",
        text: "对大段代码进行try-catch，这是不负责任的表现，分清稳定代码和非稳定代码，对非稳定的代码做对应的异常处理。",
      },
    ],
    answer: ["B", "D"],
    explain:
      "【强制】捕获异常与抛异常，必须是完全匹配，或者捕获异常是抛异常的父类。",
  },
  {
    id: 38,
    type: "multi",
    title: "关于加锁，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "可以只锁代码区块的情况下，就不要锁整个方法体。" },
      {
        key: "B",
        text: "高并发的业务场景下，要考虑加锁及同步处理带来的性能损耗，能用无锁数据结构，就不要用锁。",
      },
      { key: "C", text: "能用对象锁的情况下，就不要用类锁。" },
      { key: "D", text: "加锁时需要保持一致的加锁顺序，否则可能会造成死锁。" },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【强制】对多个资源、数据库表、对象同时加锁时，需要保持一致的加锁顺序，否则可能会造成死锁。",
  },
  {
    id: 39,
    type: "multi",
    title: "关于系统安全，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "表单、AJAX提交不需要进行CSRF安全过滤。" },
      { key: "B", text: "表单、AJAX提交必须执行CSRF安全过滤。" },
      { key: "C", text: "URL外部重定向传入的目标地址必须执行白名单过滤。" },
      {
        key: "D",
        text: "用户输入的SQL参数严格使用参数绑定或者METADATA字段值限定，防止SQL注入，禁止字符串拼接SQL访问数据库。",
      },
    ],
    answer: ["B", "C", "D"],
    explain:
      "【强制】用户输入的 SQL 参数严格使用参数绑定或者 METADATA 字段值限定，防止 SQL 注入，禁止字 符串拼接 SQL 访问数据库。",
  },
  {
    id: 40,
    type: "multi",
    title:
      "关于应用与数据库之间的操作，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "对外提供一个大而全的接口进行POJO的update更新，这样比较省事，省代码。",
      },
      {
        key: "B",
        text: "使用事务回滚的地方需要考虑各方面的回滚方案，包括缓存回滚、搜索引擎回滚、消息补偿、统计修正等。",
      },
      { key: "C", text: "应用服务器与数据库之间是短连接。" },
      { key: "D", text: "应用服务器与数据库之间是长连接。" },
    ],
    answer: ["B", "C"],
    explain: "【参考】@Transactional 事务不要滥用。",
  },
  {
    id: 41,
    type: "multi",
    title: "关于二方库的依赖处理，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "依赖于一个二方库群时，必须定义一个统一版本变量，避免各子二方库版本号不一致。",
      },
      {
        key: "B",
        text: "可以允许子项目的pom依赖中出现相同的GroupId，相同的ArtifactId，但是不同的Version。",
      },
      {
        key: "C",
        text: "所有pom文件中的依赖声明放在语句块中，所有版本仲裁放在语句块中。",
      },
      { key: "D", text: "线上应用不要依赖SNAPSHOT版本（安全包除外）。" },
    ],
    answer: ["A", "C", "D"],
    explain: "【强制】线上应用不要依赖 SNAPSHOT 版本（安全包除外）；",
  },
  {
    id: 42,
    type: "single",
    title:
      "sort表示元素在存入集合时进行了排序，数据遍历的结果是按某个排序规则输出的； 而order表示每次遍历的序列都是一样的，元素前后关系每次遍历都是确定的，那么下列哪些集合既是sort，又是order的",
    options: [
      { key: "A", text: "HashSet" },
      { key: "B", text: "LinkedList" },
      { key: "C", text: "HashMap" },
      { key: "D", text: "TreeSet" },
    ],
    answer: ["D"],
    explain:
      "【强制】判断所有集合内部的元素是否为空，使用 isEmpty() 方法，而不是 size() == 0 的方式。",
  },
  {
    id: 43,
    type: "multi",
    title:
      "关于工具类二方库已经提供的，尽量不要在本应用中编程实现，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "json操作使用fastjson。" },
      { key: "B", text: "md5操作使用commons-codec。" },
      {
        key: "C",
        text: "ArrayUtils、NumberUtils、DateFormatUtils、DateUtils等优先使用org.apache.commons.lang包。",
      },
      {
        key: "D",
        text: "CollectionUtils优先使用org.apache.commons.collections4包。",
      },
    ],
    answer: ["A", "B", "D"],
    explain: "(org.apache.commons.lang3.time.DateFormatUtils)",
  },
  {
    id: 44,
    type: "multi",
    title: "关于类和方法的命名，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "类名使用UpperCamelCase命名法，但是领域模型命名除外，如：ProductDO的命名是规范的。",
      },
      {
        key: "B",
        text: "方法名命名应该使用lowerCamelCase命名法，如方法名：getHttpMessage() 是符合命名规范的。",
      },
      {
        key: "C",
        text: "为了方便理解，方法名或参数名可以使用拼音与英文混合的方式。",
      },
      {
        key: "D",
        text: "所有编程相关的命名均不能以下划线或美元符号开始，也不能以下划线或美元符号结束。",
      },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】所有编程相关的命名均不能以下划线或美元符号开始，也不能以下划线或美元符号结束。",
  },
  {
    id: 45,
    type: "multi",
    title: "对于索引(a, b, c)，下列哪些说法是正确的",
    options: [
      { key: "A", text: "查询语句 where a between 5 and 10 可以使用该索引。" },
      {
        key: "B",
        text: "查询语句 where a = 5 and b between 5 and 10 可以使用该索引。",
      },
      {
        key: "C",
        text: "查询语句 where a in (5, 6, 7, 8, 9) and b = 5 可以使用该索引。",
      },
      { key: "D", text: "查询语句 where b = 5 and c = 10 可以使用该索引。" },
    ],
    answer: ["A", "B", "C"],
    explain: "【强制】避免用 ApacheBeanutils 进行属性的 copy。",
  },
  {
    id: 46,
    type: "multi",
    title: "根据《阿里巴巴Java开发手册》，以下哪些字段属于表的必备字段",
    options: [
      { key: "A", text: "id" },
      { key: "B", text: "gmt_modified" },
      { key: "C", text: "parent_id" },
      { key: "D", text: "gmt_create" },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】禁用保留字，如 desc、range、match、delayed 等，请参考 MySQL 官方保留字。",
  },
  {
    id: 47,
    type: "single",
    title: "单元测试代码写在Java工程的哪个地方最为合适？",
    options: [
      { key: "A", text: "写在业务代码体里边，方便调试。" },
      { key: "B", text: "写在业务代码同一个包下，方便归类查找。" },
      { key: "C", text: "写在src/test/java目录下。" },
      { key: "D", text: "写在src/java目录下。" },
    ],
    answer: ["C"],
    explain:
      "【强制】单元测试代码必须写在如下工程目录： src/test/java，不允许写在业务代码目录下。",
  },
  {
    id: 48,
    type: "multi",
    title:
      "编写单元测试代码遵守BCDE原则，以保证被测试模块的交付质量，那么下列说法正确的是",
    options: [
      {
        key: "A",
        text: "Border，边界值测试，包括循环边界、特殊取值、特殊时间点、数据顺序等。",
      },
      { key: "B", text: "Correct，正确的输入，并得到预期的结果。" },
      { key: "C", text: "Design，与设计文档相结合，来编写单元测试。" },
      { key: "D", text: "Equal， 单元测试环境必须与线上生产环境一致。(Error)" },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【推荐】编写单元测试代码遵守 BCDE 原则，以保证被测试模块的交付质量。",
  },
  {
    id: 49,
    type: "multi",
    title: "关于领域模型命名，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "数据对象命名：xxxDO，xxx即为数据表名，例如：ResellerAccountDO。",
      },
      {
        key: "B",
        text: "数据传输对象：xxxDTO，xxx为业务领域相关的名称，例如ProductDTO。",
      },
      {
        key: "C",
        text: "展示层对象：xxxVO，xxx一般为网页名称，例如RecommendProductVO。",
      },
      { key: "D", text: "POJO是DO/DTO/BO/VO的统称，命名成xxxPOJO。" },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【参考】各层命名规约： A）Service / DAO 层方法命名规约： 1）获取单个对象的方法用 get 做前缀。",
  },
  {
    id: 50,
    type: "multi",
    title: "关于客户数据展示，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "客户的密码，密钥及密保问题答案等信息禁止展示。" },
      { key: "B", text: "客户的银行卡号只显示后四位。" },
      {
        key: "C",
        text: "客户的证件号码只显示第一位和最后一位，在必要业务场景下，经多因子强验证后可完整展示。",
      },
      { key: "D", text: "涉及有完整展示客户信息的页面均需要接入防爬系统" },
    ],
    answer: ["A", "B", "C", "D"],
    explain: "【推荐】发贴、评论、发送等即时消息，需要用户输入内容的场景。",
  },
  {
    id: 51,
    type: "multi",
    title: "如何处理单元测试产生的数据，下列哪些说法是正确的？",
    options: [
      { key: "A", text: "测试数据入库时加特殊前缀标识。" },
      { key: "B", text: "测试数据使用独立的测试库。" },
      { key: "C", text: "自动回滚单元测试产生的脏数据。" },
      { key: "D", text: "无须区别，统一在业务代码中进行判断和识别。" },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【推荐】和数据库相关的单元测试，可以设定自动回滚机制，不给数据库造成脏数据。",
  },
  {
    id: 52,
    type: "multi",
    title: "关于并发处理，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "线程资源必须通过线程池提供，不允许在应用中自行显式创建线程。",
      },
      {
        key: "B",
        text: "同步处理时，能锁部分代码区块的情况下不要锁整个方法；高并发时，同步调用应该考虑到性能损耗。",
      },
      {
        key: "C",
        text: "创建线程或线程池时，推荐给线程指定一个有意义的名称，方便出错时回溯。",
      },
      {
        key: "D",
        text: "推荐使用Executors.newFixedThreadPool(int x)生成指定大小的线程池。",
      },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【强制】线程资源必须通过线程池提供，不允许在应用中自行显式创建线程。",
  },
  {
    id: 53,
    type: "multi",
    title: "下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "对于“明确停止使用的代码和配置”，如方法、变量、类、配置文件、动态配置属性等要坚决从程序中清理出去，避免造成过多垃圾。",
      },
      { key: "B", text: "永久弃用的代码段注释掉即可，即不用加任何注释。" },
      {
        key: "C",
        text: "对于暂时被注释掉，后续可能恢复使用的代码片断，在注释代码上方，统一规定使用三 个斜杠(///)来说明注释掉代码的理由。",
      },
      { key: "D", text: "不要在视图模板中加入任何复杂的逻辑。" },
    ],
    answer: ["A", "C", "D"],
    explain: "【推荐】不要在视图模板中加入任何复杂的逻辑运算。",
  },
  {
    id: 54,
    type: "multi",
    title: "关于数据库中NULL的描述，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "NULL=NULL的返回结果为true。" },
      { key: "B", text: "NULL与任何值的比较结果都为NULL。" },
      { key: "C", text: "NULL<>1的返回结果为true。" },
      { key: "D", text: "当某一列的值全是NULL时，sum(col)的返回结果为NULL。" },
    ],
    answer: ["B", "D"],
    explain: "【强制】当某一列的值全是 NULL 时，count(col) 的返回结果为 0；",
  },
  {
    id: 55,
    type: "single",
    title:
      "集合在遍历过程中，有时需要对符合一定条件的元素进行删除，下列哪些说法是正确的",
    options: [
      { key: "A", text: "在 foreach 循环里进行元素的 remove操作。" },
      {
        key: "B",
        text: "使用Iterator方式，如果有并发，需要对Iterator对象加锁。",
      },
      { key: "C", text: "Iterator进行元素的删除操作，绝对是线程安全的。" },
      { key: "D", text: "Java无法实现在遍历时，进行删除元素操作。" },
    ],
    answer: ["B"],
    explain: "【强制】不要在 foreach 循环里进行元素的 remove / add 操作。",
  },
  {
    id: 56,
    type: "multi",
    title:
      "关于基本数据类型与包装数据类型的使用标准，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "所有的POJO类属性必须使用包装数据类型。" },
      { key: "B", text: "RPC方法的返回值和参数必须使用包装数据类型。" },
      {
        key: "C",
        text: "因为JAVA的自动装箱与拆箱机制，不需要根据场景来区分数据类型。",
      },
      { key: "D", text: "所有的局部变量推荐使用基本数据类型。" },
    ],
    answer: ["A", "B", "D"],
    explain: "【强制】所有的枚举类型字段必须要有注释，说明每个数据项的用途。",
  },
  {
    id: 57,
    type: "multi",
    title:
      "关于二方库版本号的命名方式，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "版本号命名格式：主版本号.次版本号.修订号。" },
      {
        key: "B",
        text: "主版本号:产品方向改变，或者大规模API不兼容，或者架构不兼容升级。",
      },
      {
        key: "C",
        text: "次版本号:保持相对兼容性，增加主要功能特性，影响范围极小的API不兼容修改。",
      },
      {
        key: "D",
        text: "修订号:保持完全兼容性，修复BUG、新增次要功能特性等。",
      },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【强制】二方库版本号命名方式：主版本号.次版本号.修订号 1）主版本号：产品方向改变，或者大规模 API 不兼容，或者架构不兼容升级。",
  },
  {
    id: 58,
    type: "multi",
    title: "关于代码注释，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "特殊注明标记人与标记时间。" },
      {
        key: "B",
        text: "待办事宜（TODO）:（ [标记人，标记时间，[预计处理时间]）",
      },
      {
        key: "C",
        text: "在注释中用FIXME标记某代码虽然实现了功能，但是实现的方法有待商榷，希望将来能改进",
      },
      {
        key: "D",
        text: "在注释中用FIXME标记某代码是错误的，而且不能工作，需要及时纠正的情况",
      },
    ],
    answer: ["A", "B", "D"],
    explain: "【参考】特殊注释标记，请注明标记人与标记时间。",
  },
  {
    id: 59,
    type: "multi",
    title: "关于索引的设计和使用，下列哪些说法是正确的：",
    options: [
      { key: "A", text: "若查询条件中不包含索引的最左列，则无法使用索引。" },
      { key: "B", text: "对于范围查询，只能利用索引的最左列。" },
      {
        key: "C",
        text: "对于order by A或group by A语句，在A上建立索引，可以避免排序。",
      },
      {
        key: "D",
        text: "对于多列排序，需要所有所有列排序方向一致，才能利用索引。",
      },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【强制】页面搜索严禁左模糊或者全模糊，如果需要请走搜索引擎来解决。",
  },
  {
    id: 60,
    type: "multi",
    title: "关于类命名，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "抽象类命名使用Abstract或Base开头。" },
      { key: "B", text: "异常类命名使用Exception结尾。" },
      { key: "C", text: "测试类命名以它要测试的类的名称开始，以Test结尾。" },
      {
        key: "D",
        text: "如果使用到了设计模式，建议在类名中体现出具体模式。例如代理模式的类命名：LoginProxy；观察者模式命名：ResourceObserver。",
      },
    ],
    answer: ["A", "B", "C", "D"],
    explain: "【强制】抽象类命名使用 Abstract 或 Base 开头；",
  },
  {
    id: 61,
    type: "multi",
    title: "关于数据库模糊检索的描述，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "绝对禁止左模糊。" },
      { key: "B", text: "绝对禁止全模糊。" },
      { key: "C", text: "绝对禁止右模糊。" },
      { key: "D", text: "全模糊或左模糊查询需求，优先使用搜索引擎。" },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】页面搜索严禁左模糊或者全模糊，如果需要请走搜索引擎来解决。",
  },
  {
    id: 62,
    type: "single",
    title: "关于Map类型集合的遍历方式，下列哪些说法是正确的",
    options: [
      { key: "A", text: "Map类型的实现类都同时实现了Iterator接口。" },
      { key: "B", text: "使用foreach进行遍历。" },
      { key: "C", text: "推荐使用keySet进行遍历。" },
      { key: "D", text: "推荐使用entrySet进行遍历。" },
    ],
    answer: ["D"],
    explain:
      "【强制】使用 Map 的方法 keySet() / values() / entrySet() 返回集合对象时，不可以对其进行添加元素 操作，否则会抛出 UnsupportedOperationException 异常。",
  },
  {
    id: 63,
    type: "multi",
    title:
      "关于变量、方法名、包的命名，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "POJO类中的任何布尔类型的变量，都不要加is，因为部分框架解析时有可能会出现序列化错误。",
      },
      { key: "B", text: "包名统一使用单数形式，如：com.alibaba.mpp.util。" },
      {
        key: "C",
        text: "中括号是数组类型的一部分，数组定义如下：String[] args; 不要误写为String args[]；",
      },
      {
        key: "D",
        text: "Service/DAO层方法命名可以参考规约，例如：删除的方法推荐使用remove或delete做前缀。",
      },
    ],
    answer: ["A", "B", "C", "D"],
    explain: "【强制】类型与中括号紧挨相连来定义数组。",
  },
  {
    id: 64,
    type: "multi",
    title: "关于maven依赖、仲裁、规则，下列哪些说法是正确的",
    options: [
      { key: "A", text: "<dependencies>的依赖会默认传递给子项目。" },
      { key: "B", text: "<dependencies>的依赖绝对不会传递给子项目。" },
      { key: "C", text: "在<dependencyManagement>中指定版本号。" },
      { key: "D", text: "避免在不同的子项目，声明同一个二方库的不同版本号。" },
    ],
    answer: ["A", "C", "D"],
    explain:
      "【推荐】所有 pom 文件中的依赖声明放在<dependencies>语句块中，所有版本仲裁放在 <dependencyManagement>语句块中。",
  },
  {
    id: 65,
    type: "single",
    title: "关于二方库升级，下列哪些说法是正确的",
    options: [
      { key: "A", text: "升级二方库只是改个版本号，不需要关联功能的回归。" },
      { key: "B", text: "升级二方库需要比对仲裁结果的差异，谨慎评估。" },
      { key: "C", text: "升级二方库，绝对不会影响到其它二方库的版本号。" },
      {
        key: "D",
        text: "只要此二方库负责人保证说不会有任何影响，即可大胆升级，直接发布上线。",
      },
    ],
    answer: ["B"],
    explain:
      "【强制】二方库的新增或升级，保持除功能点之外的其它 jar 包仲裁结果不变。如果有改变，",
  },
  {
    id: 66,
    type: "multi",
    title: "关于表字段和索引，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "表字段注释，如果修改字段含义或对字段表示的状态追加时，需要及时更新。",
      },
      {
        key: "B",
        text: "合适的字符存储长度，不但节约数据库表空间、节约索引存储，更重要的是提升检索速度。",
      },
      { key: "C", text: "针对表的每个字段都增加索引，加快查询速度。" },
      { key: "D", text: "字段的区分度越高，索引的查找速度越快。" },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【参考】合适的字符存储长度，不但节约数据库表空间、节约索引存储，更重要的是提升检索速度。",
  },
  {
    id: 67,
    type: "multi",
    title: "关于数据库命名规则，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "数据库库名和表名没有规定，可任意取名，只要方便记忆即可。",
      },
      {
        key: "B",
        text: "库名应该尽量与应用名称保持一致，表的命名最好是业务名称_表名的方式。",
      },
      {
        key: "C",
        text: "无论是库名还是表名都禁用保留字，如desc、match、range等。",
      },
      { key: "D", text: "表名、字段名必须使用小写字母或数字。" },
    ],
    answer: ["B", "C", "D"],
    explain:
      "【强制】表名、字段名必须使用小写字母或数字，禁止出现数字开头禁止两个下划线中间只出现数字。",
  },
  {
    id: 68,
    type: "multi",
    title: "关于文件编码和格式的设定，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "IDE的text file encoding设置为GBK格式。" },
      { key: "B", text: "IDE的text file encoding设置为UTF-8格式。" },
      { key: "C", text: "IDE中文件的换行符使用unix格式。" },
      { key: "D", text: "IDE中文件的换行符使用windows格式。" },
    ],
    answer: ["B", "C"],
    explain: "【强制】IDE 的 text file encoding 设置为 UTF-8；",
  },
  {
    id: 69,
    type: "multi",
    title:
      "关于数据库是与否概念的列的命名方式，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "对于是与否概念的列名，必须使用can_abc 来表示。" },
      { key: "B", text: "对于是与否概念的列名，必须使用is_abc 来表示。" },
      { key: "C", text: "数据类型是varchar(1)（ Y表示是，N表示否）。" },
      { key: "D", text: "数据类型是unsigned tiny int.（ 1表示是，0表示否）。" },
    ],
    answer: ["B", "D"],
    explain:
      "【强制】表达是与否概念的字段，必须使用 is_xxx 的方式命名，数据类型是 unsigned tinyint（1 表示 是，0 表示否）。",
  },
  {
    id: 70,
    type: "multi",
    title: "通过集合A.subList()获取子集合B，下列说法哪些是正确的",
    options: [
      {
        key: "A",
        text: "返回的集合B没有实现Serializable接口，不能被序列化，所以不能应用于RPC场景。",
      },
      {
        key: "B",
        text: "在B集合中添加某个元素，那么A集合也会添加进去此元素。",
      },
      { key: "C", text: "集合A中元素的修改不会影响到集合B的任何操作。" },
      {
        key: "D",
        text: "对A元素个数的修改，会导致集合B的遍历产生ConcurrentModificationException 异常。",
      },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】在 subList 场景中，高度注意对父集合元素的增加或删除，均会导致子列表的遍历、增加、删 除产生 ConcurrentModificationException 异常。",
  },
  {
    id: 71,
    type: "multi",
    title: "关于捕获异常和抛异常，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "如果需要捕获不同类型异常，为了方便处理，可以使用catch(Exception e){...}。",
      },
      { key: "B", text: "不要捕获异常后不处理，丢弃异常信息。" },
      {
        key: "C",
        text: "捕获异常与抛异常，必须是完全匹配，或者捕获异常是抛异常的父类。",
      },
      {
        key: "D",
        text: "异常定义时区分unchecked / checked 异常，避免直接使用RuntimeException抛出。",
      },
    ],
    answer: ["B", "C", "D"],
    explain:
      "【强制】捕获异常与抛异常，必须是完全匹配，或者捕获异常是抛异常的父类。",
  },
  {
    id: 72,
    type: "multi",
    title: "为了更方便地进行单元测试，被测试的业务代码应避免以下哪些情况？",
    options: [
      { key: "A", text: "构造方法中做的事情过多。" },
      { key: "B", text: "存在过多的全局变量和静态方法。" },
      { key: "C", text: "存在过多的外部依赖。" },
      { key: "D", text: "存在过多的条件语句。" },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【参考】为了更方便地进行单元测试，业务代码应避免以下情况： ⚫ 构造方法中做的事情过多。",
  },
  {
    id: 73,
    type: "multi",
    title: "关于控制语句，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "推荐 if-else的方式可以改写成卫语句的形式。" },
      {
        key: "B",
        text: "尽量减少try-catch 块内的逻辑，定义对象、变量、获取数据库连接等操作可以移到try-catch块外处理",
      },
      {
        key: "C",
        text: "if ( condition) statements; 单行语句不需要使用大括号。",
      },
      {
        key: "D",
        text: "在一个switch块内，都必须包含一个default语句并且放在最后，即使它什么代码也没有。",
      },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】在一个 switch 块内，每个 case 要么通过 continue / break / return 等来终止，要么注释说明 程序将继续执行到哪一个 case 为止；",
  },
  {
    id: 74,
    type: "multi",
    title: "关于参数有效性验证，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "防止page size过大导致内存溢出。" },
      { key: "B", text: "防止正则输入源串拒绝服务ReDOS。" },
      { key: "C", text: "防止任意重定向。" },
      { key: "D", text: "预防 SQL 注入。" },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【强制】sql.xml 配置参数使用：#{}，#param# 不要使用 ${} 此种方式容易出现 SQL 注入。",
  },
  {
    id: 75,
    type: "single",
    title:
      "在定义DO/DTO/VO/等POJO类时，对属性默认值的设定，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "String类型的默认值设定为空字符串。" },
      { key: "B", text: "Date类型的默认值设定为new Date()。" },
      { key: "C", text: "集合类型的默认值设定为Collections.EMPTY_LIST。" },
      { key: "D", text: "不要设定任何属性默认值。" },
    ],
    answer: ["D"],
    explain: "【强制】定义 DO/DTO/VO 等 POJO 类时，不要设定任何属性默认值。",
  },
  {
    id: 76,
    type: "multi",
    title: "关于Java代码的设计和开发注意事项，下列哪些说法符合《集合开发规约》",
    options: [
      {
        key: "A",
        text: "禁止将URL、文件名、系统参数、数据库连接地址、业务规则的可变参数，硬编码在工程中。",
      },
      { key: "B", text: "long或者Long初始赋值时，必须是大写的L，不能小写。" },
      {
        key: "C",
        text: "当一个类有多个构造方法，或是多个同名方法，这些方法应该按顺序放置在一起，便于阅读。",
      },
      {
        key: "D",
        text: "相同参数类型，同等业务含义，才可以使用Java的可变参数，参数的类型尽量避免使用Object。",
      },
    ],
    answer: ["A", "B", "C", "D"],
    explain:
      "【推荐】当一个类有多个构造方法，或者多个同名方法，这些方法应该按顺序放置在一起，便于阅读， 此条规则优先于下一条。",
  },
  {
    id: 77,
    type: "multi",
    title: "关于数据库索引的命名，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "主键索引(primary key)，字段类型为unsigned bigint、单表时推荐自增、步长为1。",
      },
      {
        key: "B",
        text: "主键索引(primary key)，字段类型为unsigned bigint、单表时推荐自增、步长为2。",
      },
      {
        key: "C",
        text: "唯一索引（unique key），命名规则为uk_字段名（如果多个字段继续下划线）。",
      },
      {
        key: "D",
        text: "普通索引(normal index)，标记成idx_字段名（如果多个继续下划线）。",
      },
    ],
    answer: ["A", "C", "D"],
    explain: "【强制】主键索引名为 pk_字段名；",
  },
  {
    id: 78,
    type: "multi",
    title: "关于类和方法，下列哪些符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "任何类、方法，严控访问范围。过宽泛的访问范围，不利于模块解耦。",
      },
      {
        key: "B",
        text: "对外暴露的接口签名，原则上不允许修改，宁可新增，避免对依赖端产生影响。",
      },
      {
        key: "C",
        text: "如果新增一个功能完全相同的新接口，过时接口必须加 @Deprecated 注释。",
      },
      { key: "D", text: "所有过时的类与方法不得使用。" },
    ],
    answer: ["A", "B", "C"],
    explain:
      "【推荐】对外暴露的接口不允许修改方法签名；接口过时必须加 @Deprecated，并清晰说明替代方案。",
  },
  {
    id: 79,
    type: "multi",
    title: "使用 CountDownLatch 进行异步转同步操作时，下列哪些说法是正确的",
    options: [
      { key: "A", text: "每个线程退出前必须调用 countDown() 方法。" },
      {
        key: "B",
        text: "线程执行代码注意 catch 异常，确保 countDown() 方法可以被执行。",
      },
      { key: "C", text: "子线程抛出异常堆栈，可以直接在主线程 catch 到。" },
      { key: "D", text: "子线程抛出异常堆栈，不能在主线程 try-catch 到。" },
    ],
    answer: ["A", "B"],
    explain:
      "【推荐】每个线程退出前必须 countDown，并 catch 异常确保 countDown 被执行，避免主线程无法执行至 await。",
  },
  {
    id: 80,
    type: "multi",
    title: "数据库表设计允许适当冗余以提升查询性能，下列哪些字段不允许冗余",
    options: [
      { key: "A", text: "text 类型的字段。" },
      { key: "B", text: "基本固定不变的类目名称。" },
      { key: "C", text: "varchar(2500) 的超长字段。" },
      { key: "D", text: "需要频繁修改的字段。" },
    ],
    answer: ["A", "C", "D"],
    explain:
      "【推荐】冗余字段应不是频繁修改的字段，不能是 varchar 超长字段，更不能是 text 字段。",
  },
  {
    id: 81,
    type: "multi",
    title: "关于类内方法定义的顺序，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "公有方法或保护方法 > 私有方法 > getter/setter 方法。",
      },
      { key: "B", text: "私有方法 > 公有方法 > getter/setter 方法。" },
      { key: "C", text: "Service 和 DAO 的 getter/setter 方法放在类体最后。" },
      { key: "D", text: "getter/setter 方法必须放在类的最开头。" },
    ],
    answer: ["A", "C"],
    explain:
      "【推荐】类内方法定义的顺序依次是：公有方法或保护方法 > 私有方法 > getter / setter 方法。",
  },
  {
    id: 82,
    type: "single",
    title: "关于 Random 在多线程环境下的使用，下列说法正确的是",
    options: [
      {
        key: "A",
        text: "Random 实例被多线程共享是线程安全的，推荐共享同一个实例。",
      },
      {
        key: "B",
        text: "推荐使用 ThreadLocalRandom，避免多线程竞争同一 seed 导致性能下降。",
      },
      {
        key: "C",
        text: "多线程环境下必须使用 synchronized 包装 Random 才能使用。",
      },
      { key: "D", text: "Random 不能用于多线程环境。" },
    ],
    answer: ["B"],
    explain:
      "【推荐】避免 Random 实例被多线程使用，虽然共享该实例是线程安全的，但会因竞争同一 seed 导致 的性能下降。",
  },
  {
    id: 83,
    type: "single",
    title:
      "关于高并发场景下的计数操作，下列说法符合《阿里巴巴Java开发手册》的是",
    options: [
      {
        key: "A",
        text: "JDK8 中推荐使用 LongAdder 对象，比 AtomicLong 性能更好。",
      },
      { key: "B", text: "count++ 操作在高并发下不需要特殊处理。" },
      {
        key: "C",
        text: "必须使用 synchronized 关键字才能保证 count++ 的正确性。",
      },
      { key: "D", text: "LongAdder 不能用于并发计数场景。" },
    ],
    answer: ["A"],
    explain:
      "【参考】volatile 解决多线程内存不可见问题对于一写多读，是可以解决变量同步问题，但是如果多 写，同样无法解决线程安全问题。",
  },
  {
    id: 84,
    type: "multi",
    title:
      "关于并发修改同一记录时的加锁策略，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "并发修改同一记录时，需要加锁，避免更新丢失。" },
      {
        key: "B",
        text: "如果每次访问冲突概率小于 20%，推荐使用乐观锁，否则使用悲观锁。",
      },
      { key: "C", text: "乐观锁的重试次数不得小于 3 次。" },
      { key: "D", text: "并发修改同一记录时，不需要任何加锁机制。" },
    ],
    answer: ["A", "B", "C"],
    explain: "【强制】并发修改同一记录时，避免更新丢失，需要加锁。",
  },
  {
    id: 85,
    type: "multi",
    title: "关于二方库 GAV 命名规则，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      {
        key: "A",
        text: "GroupID 格式：com.{公司/BU}.业务线[.子业务线]，最多 4 级。",
      },
      {
        key: "B",
        text: "ArtifactID 格式：产品线名-模块名，语义不重复不遗漏。",
      },
      { key: "C", text: "Version 号必须随机生成以保证唯一性。" },
      { key: "D", text: "Version 详细规定：主版本号.次版本号.修订号。" },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【强制】定义 GAV 遵从以下规则： 1）GroupId 格式：com.{公司/BU}.业务线.[子业务线]，最多 4 级。",
  },
  {
    id: 86,
    type: "multi",
    title: "关于常量的复用层次，下列哪些说法符合《阿里巴巴Java开发手册》",
    options: [
      { key: "A", text: "跨应用共享常量放在二方库的 constant 目录下。" },
      { key: "B", text: "应用内共享常量放在子模块的 constant 目录下。" },
      { key: "C", text: "所有常量必须写在同一个全局 Constants 类中。" },
      {
        key: "D",
        text: "类内共享常量可直接在类内部 private static final 定义。",
      },
    ],
    answer: ["A", "B", "D"],
    explain:
      "【推荐】常量的复用层次有五层：跨应用共享常量、应用内共享常量、子工程内共享常量、包内共享常 量、类内共享常量。",
  },
];

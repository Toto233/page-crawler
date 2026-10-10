# 架构与数据流

这是一个便于直接安装的单文件用户脚本，使用 IIFE 包裹内部状态。独立项目补充了运行、文档、媒体与验证工具，没有把同一套动作复制到多个运行入口。

## 两个运行入口

`index.html` 通过普通 script 标签加载核心；Tampermonkey 根据元数据在 HTTP/HTTPS 页面注入同一文件。没有 GM 接口时使用默认配置，有 GM 接口时保存设置和网站排除列表。Overlay Host 的 ID 检查避免重复注入。

```mermaid
flowchart LR
  Demo[index.html] --> Core[page-crawler.user.js]
  TM[Tampermonkey 注入] --> Core
  Mouse[鼠标与页面滚动] --> Core
  Core --> Model[身体 / 八条腿 / 捕食状态]
  Model --> Canvas[赛博款 Canvas / 普通款 SVG 投影与阴影]
  Core --> Effect[可恢复 DOM 动画]
  Tests[Playwright 检查] --> Status[只读 crawlerStatus]
  Core --> Status
```

## 核心区域

| 区域与函数 | 职责 |
| --- | --- |
| config、listen、resize | 配置与事件生命周期、画布像素比、尺寸改变 |
| world、hipFor、idealFoot | 身体局部坐标变换、髋部位置、期望落脚点 |
| supportMargin | 落地脚的凸包及身体到边界的最小有符号距离 |
| chooseFoothold、updateLegs | 提前选择落点、保持环绕次序、独立迈步与落地 |
| solveLeg、project | 弓形链闭合、固定骨长与三维到二维投影 |
| createGhostRenderer、drawGhost | 建立并复用 SVG 节点，以求解后的骨架投影绘制自然造型 |
| huntReady、updateHunt、huntStage | 捕食武装、阶段推进、短促腾空、抓握与恢复 |
| targetAt、nearestWord、impact、release、restore | 可处理 DOM 识别、可撤销形变、文字碎片与清理 |
| tick、draw、synchronize | 一帧的调度、绘制、暂停与后台管理 |
| scrollCreature | 将身体、轨迹、目标与视觉痕迹随页面滚动搬移 |
| crawlerStatus | 供本地检查读取位置、骨骼、落地记录和动作计数 |

## 一帧的顺序

1. 计算时间差并限制到 40 ms，更新时间。
2. 将最新鼠标位置或自主漫步位置设为目标。
3. 捕食动作活跃时，由 `updateHunt` 接管身体与腿；结束本帧普通导航。
4. 普通行走更新角速度和前进速度，通过支撑与腿长条件验证候选姿态。
5. 更新已起步的腿，并选择下一条需要迈步且允许抬起的腿。
6. 清理失效 DOM 效果，求解三维骨架，绘制地面痕迹、阴影、腿和身体。
7. 请求下一帧。

## 状态与坐标

- `body`：视口内 x/y、离开页面的 z、角度、累计距离与速度。
- `legs`：脚尖位置和高度、planted/swing/airborne/grasp、摆动起终点、阶段进度、三维关节。
- `hunt`：idle/gather/crouch/airborne/landing/feeding/recover，目标、起跳原点、计时、冷却和结果。
- `effects`：网页元素的临时动画；不以这些元素的形变作为脚尖坐标。
- 正常支撑脚 z=0，腾空脚 z>0。滚动只平移页面相关的 x/y，不重置计时和骨架阶段。

捕食过程中 `hunt.feet` 在腾空阶段保存相对身体的偏移，落地后保存页面中的绝对位置。处理滚动时必须区分这两种表示，否则会重复扣除滚动位移。

`hunt.windup` 保存蓄力前的页面位置；`prepareWindup` 在脚尖不滑动的条件下验证可后移距离，`coilPose` 给出压低和收身姿态。`body.coil` 同时控制髋部与腹部，腾空前半段释放。页面滚动也必须平移 windup，否则暂停蓄力后恢复会跳回旧位置。

## 三种外观

“蜘蛛外观”下拉框使用 `config.appearance`：`cyber`、`ghost`、`marbled`。载入旧设置时，缺失或无效的 appearance 根据 `neon` 映射到赛博款或普通款；保存时同步 neon，兼容旧的配置标记。赛博款用 Canvas 绘制蓝紫色分块身体、冷蓝发光线路、菱形关节和轻微紫红错色边缘；两种自然款用同一棵内嵌 SVG 绘制身体、32 段腿、节环、细毛与阴影，Canvas 继续负责网页痕迹和文字碎片。

SVG 节点只建立一次，每帧更新坐标，按三维深度排序；不加载外部图片，也不重建整棵节点树。普通款的八条腿都连接到小头胸部，其根部局部坐标与赛博款不同；骨长、脚尖落点和动作状态仍由原有求解器维护。切换时不会重置身体、脚或捕食进度，暂停时也能立即更新外观。

`applyNaturalSkin` 只在自然皮肤变化时更新渐变、颜色和腹部纹样显示。斑腹款与普通款的三维骨长、腿根、落脚点和求解结果完全一致，区别为灰褐腹部、较强的背部叶状斑纹与深色腿环。节环长度是沿已求解腿段绘制的标记，不改变骨长。

## 后续修改的位置

性能调度使用 `paint`、`updateBudget` 与 `wake`。物理状态更新和绘制频率分开，`poseRevision` 标记当前骨架是否需要重算；`solvePose` 在绘制或诊断读取时按需计算。到达鼠标并收稳后停止帧循环，交互事件再唤醒；SVG 用 `svgAttribute` 跳过没有变化的属性写入。参数、测量及取舍见 [CPU 性能](performance.md)。

诊断中的 `running` 表示脚本已启用且未暂停/隐藏；`sleeping` 表示当前没有持续帧循环。休眠时 running 仍为 true，事件可以直接唤醒。`performance` 提供当前绘制上限、工作耗时均值和 Canvas 像素比，诊断读取不会触发绘制。

改外观从 `draw` 开始；改站姿从 `restAngles`、`restRadius`、`skeleton` 开始；改行走从 `chooseFoothold` 和 `updateLegs` 开始；改扑击从 `updateHunt` 开始。每次只调整一种行为，再跑相关的实际浏览器检查。

若未来做扩展，可将当前用户脚本用作 content script 的逻辑基础，并替换 GM 配置与菜单接口。项目现在没有 extension manifest、后台脚本或扩展安装流程。

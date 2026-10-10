# 论文、参考资料与素材来源

## 用户提供的运动论文

**Tom Weihmann (2013)**. *Crawling at High Speeds: Steady Level Locomotion in the Spider Cupiennius salei—Global Kinematics and Implications for Centre of Mass Dynamics*. PLoS ONE 8(6): e65788.

- [论文全文](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0065788)
- [DOI](https://doi.org/10.1371/journal.pone.0065788)
- [Figure 1](https://doi.org/10.1371/journal.pone.0065788.g001)
- [本地 Figure 1 图片](../assets/reference/paper-foot-trajectories.png)

采用的结构依据是功能弓形腿，以及前两对、侧方第三对、后方第四对不同的接触分布。研究对象为 **Cupiennius salei 的直线匀速运动**，并非幽灵蛛急转身或捕食扑跳实验。[来源：论文的 Leg characteristics、Figure 1 和 Abstract](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0065788)。

项目据此选择模型结构，但长度比例、转向速度、跳跃高度、捕食范围和冷却时间均由动画实现与回放调节。直线运动中的小幅 yaw 不应当作急转角度上限；文中无腾空的直线跑动也不等于“蜘蛛不能跳”。当前捕食动作是用户提出的演示功能，未声称复制某个物种的捕食生物力学。

![论文中的脚尖接触分布](../assets/reference/paper-foot-trajectories.png)

**图片署名：** Figure 1，Tom Weihmann，2013，PLOS ONE，doi:10.1371/journal.pone.0065788.g001。原论文标注 Creative Commons Attribution License，转载保留作者与来源；图像未修改。完整来源说明见 [assets/reference/credits.md](../assets/reference/credits.md)。

## 幽灵蛛外观参考

普通款以长腹幽灵蛛 **Pholcus phalangioides** 为造型参考。采用小而近圆的浅黄褐色头胸部、中央深色斑、细长腹部与淡斑、极细长腿和深色关节。资料见 [英国蛛形学会事实页](https://britishspiders.org.uk/sites/default/files/2020-08/Daddy_long-legs_spider_preview_rev18.pdf)和 [澳大利亚博物馆物种介绍](https://australian.museum/learn/animals/spiders/daddy-long-legs-spider/)。

SVG 图形由本项目绘制，没有复制或打包外部照片。渲染中的尺寸、渐变、透明度与细毛用于页面尺度下的视觉表现；网页扑跳继续作为交互动画，外观参考不代表捕食动作也经过该物种的生物力学验证。

## 第三套：斑腹幽灵蛛

采用 **Holocnemus pluchei**（Marbled Cellar Spider，界面称“斑腹幽灵蛛”）作参考。它同属幽灵蛛科，具有细长腿和小身体，腹部斑纹更强，适合沿用普通款的长腿轮廓。辨识说明见 [澳大利亚博物馆](https://australian.museum/learn/animals/spiders/daddy-long-legs-spider/)，成体外观见 [加州大学 IPM 的 Richard S. Vetter 摄影](https://ipm.ucanr.edu/PMG/H/I-AR-HPLU-AD.009.html)。[CSU Bakersfield · Carl T. Kloock 本地蜘蛛图鉴](https://www.csub.edu/~ckloock/documents/guide-to-local-spiders.pdf)提供该种腹部 folium（叶状纹）与其他鉴别特征。[UC Davis Bohart Museum](https://bohart.ucdavis.edu/sites/g/files/dgvnsk4616/files/media/documents/note_36_cellar_spider.pdf)说明这类幽灵蛛常见灰白色身体与较暗的腿关节。

SVG 将这些特征简化为灰褐色腹部、深色叶状斑纹、褐色细腿与深色节环。资料提及的深色腹面条带没有画成背面条纹。渐变与颜色对比按网页显示尺度调整，未复制、打包外部照片；两种自然皮肤的骨长和步态完全共用项目模型，未声称它们的真实行走或捕食动作相同。

## 赛博造型的视觉参考

当前赛博款试作采用 Spider-Byte 的蓝紫数字感方向，同时参考《蜘蛛侠：纵横宇宙》的漫画化表现。项目将这些视觉印象转成冷蓝线路、紫红色错位边缘、静态网点、分块轮廓和镜片状眼部；这是用于八足网页蜘蛛的原创改造。背景资料见 [Sony 官方幕后介绍](https://www.sony.com/en/brand/beyondthescreen/acrossthespiderverse/)和 [Sony Pictures Imageworks 的影片页面](https://www.imageworks.com/node/3001)。没有把电影截图打包为项目素材。

## 官方技术资料

| 来源 | 对应学习内容 |
| --- | --- |
| [MDN · requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) | 按真实时间差推进动画和处理后台恢复 |
| [MDN · CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) | 线段、关节、阴影、变换和深度排序的绘制基础 |
| [MDN · SVG](https://developer.mozilla.org/en-US/docs/Web/SVG) | 普通幽灵蛛的路径、渐变、阴影与坐标变换 |
| [MDN · Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) | 可撤销的网页形变动画 |
| [MDN · Element.attachShadow](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow) | 覆盖层面板样式隔离 |
| [MDN · PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent) | 鼠标目标与触摸输入区分 |
| [Tampermonkey 官方文档](https://www.tampermonkey.net/documentation.php) | 用户脚本元数据、配置与菜单接口 |
| [Playwright · Browsers](https://playwright.dev/docs/browsers) | 测试用 Edge 和 Chromium 的选择与安装 |

## 本项目媒体

演示照片和视频由实际脚本在浏览器中生成，见 [图册](gallery.md)。论文图是外部科学参考图，单独存放并署名，不是项目运行截图。原始用户参考视频没有放入可移植项目包，避免依赖用户电脑上的下载目录。

# 演示照片与视频

浏览器入口：[gallery.html](../gallery.html)。全部本项目图片由真实浏览器截图生成，没有使用概念图代替运行效果。

## 三种外观

![赛博蜘蛛](../assets/images/preview-cyber.png)

赛博款采用蓝紫全息风格：分块身体、冷蓝发光线路、紫红错色边缘、菱形关节与白色镜片状眼部。图形由项目绘制，保持八足蜘蛛形态。

![SVG 普通幽灵蛛](../assets/images/preview-ghost.png)

普通款以长腹幽灵蛛为参考，用 SVG 绘制浅黄褐色的小头胸部、灰米色长腹、深色节环与细毛。在控制面板的“蜘蛛外观”中切换。

![SVG 斑腹幽灵蛛](../assets/images/preview-marbled.png)

第三套参考 Holocnemus pluchei，采用灰褐色腹部、叶状深斑、褐色细腿和更醒目的深色节环。与普通款共用全部骨架和动作，切换时保留正在进行的迈步与扑跳。物种来源见 [参考资料](research.md)。

## 快速扑击 · v1.0.0

![腾空时收腿与高度阴影](../assets/images/preview-hunt-airborne.png)

腾空阶段：脚尖离地，腿向内收，阴影与身体分离。

![落地后的抓握捕食](../assets/images/preview-hunt-feeding.png)

捕食阶段：前腿抬起抓握，口器开合，其他脚保持支撑。

![捕食结束后站姿](../assets/images/preview-hunt.png)

捕食结束：保持站姿，不因静止光标反复跳跃。

[正常速度捕食 MP4](../assets/videos/hunt.mp4)：包含成功捕食、目标逃开后的扑空，以及再次追赶捕食。浏览器图册可直接播放。

## 页面演示与窄屏

![桌面网页接触效果](../assets/images/preview-desktop.png)

![窄屏布局与控制面板](../assets/images/preview-mobile.png)

这两张图由页面回归检查生成，关闭捕食以集中展示网页接触、控制面板与布局。

## 行走回放

![稳定站姿与地面阴影](../assets/images/preview-motion.png)

[正常速度行走 MP4](../assets/videos/walk.mp4)：使用当前 v1.0.0 核心，关闭捕食，展示直行、180° 转身与目标处保持站姿。可通过 `npm run record:walk` 重新录制。

## 文件对应

| 素材 | 文件 |
| --- | --- |
| 快速扑击/捕食/站姿 | `assets/images/preview-hunt-*.png`、`preview-hunt.png` |
| 桌面与窄屏 | `assets/images/preview-desktop.png`、`preview-mobile.png` |
| 行走截图 | `assets/images/preview-motion.png` |
| 正常速度回放 | `assets/videos/hunt.mp4`、`walk.mp4` |
| 外部论文图 | `assets/reference/paper-foot-trajectories.png`，署名见同目录 credits.md |

更新照片与视频的步骤见 [测试与录制](testing.md)。

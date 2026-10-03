# 测试、照片与录制

## 安装与浏览器

```sh
npm ci
npm test
```

Playwright 是开发依赖，页面本身不需要它。Windows 默认使用已安装的 Edge；Linux/macOS 默认使用 Playwright Chromium，首次使用先运行 `npm run browser:install`。Windows 改用同一套 Chromium：

```powershell
npm run browser:install
$env:CRAWLER_BROWSER_CHANNEL = 'bundled'
npm test
```

指定其他已安装的 Chromium channel 可设置 `CRAWLER_BROWSER_CHANNEL`，例如 `chrome`。配置实现见 `tests/browser.cjs`，浏览器要求见 [Playwright 官方文档](https://playwright.dev/docs/browsers)。

## 七组检查

| 脚本 | 检查目标 |
| --- | --- |
| `tests/check.cjs` | 桌面/窄屏、形变恢复、原有样式、输入和链接、动态 DOM、快捷键、重复注入、完全清理 |
| `tests/gait-check.cjs` | 固定骨长、同向弓形、投影变化、独立迈步、地面接触、空白页和内容移除 |
| `tests/collision-check.cjs` | 指定 600 帧行走回放中的三维腿间距、投影交叉和脚尖次序 |
| `tests/follow-scroll-check.cjs` | 鼠标追随、实际滚轮位移、暂停滚动、页面坐标与视野外返回 |
| `tests/navigation-check.cjs` | 空白页前进、反向追随、到达后停止踱步与小幅目标变动 |
| `tests/articulation-check.cjs` | 固定 60 Hz 下弯折平面连续性、近端参与、骨长、支撑区域与半转耗时 |
| `tests/hunt-check.cjs` | 三种速度下短促腾空、空中速度、刚性骨长、支撑、捕获/扑空、重新武装、暂停滚动与开关 |

前六组明确关闭捕食以独立检查行走；捕食由最后一组检查。碰撞回放排除身体内半径 26 的连接区域，外部腿间距小于 3 判为穿模。检查结果只覆盖这些具体场景，不能据此宣称在所有任意目标与页面上不存在穿模。

全部检查顺序执行。`artifacts/validation/summary.json` 保存版本、源码 SHA-256、各检查退出结果与耗时；每组另写详细 JSON。运行结果、原始录制、依赖目录和生成包均留在本地，不提交到 Git；图册中选定的当前演示照片和 MP4 是项目素材，随源码提交。

启动本地服务器后，`npm run test:project` 另行检查文档本地链接、图册照片、视频元数据和 HTTP Range 播放支持，并保存项目页面截图。

局部验证命令：

```sh
npm run test:hunt
npm run test:legs
npm run test:collision
```

## 再生成照片和 MP4

```sh
npm run record:hunt
npm run record:walk
```

两条命令使用实际核心脚本，正常速度录制；不会启动第二套模拟实现。原始 WebM 放在 `artifacts/capture/`，终端最后输出其绝对路径。截图放在 `artifacts/validation/`。

安装 ffmpeg 并加入 PATH 后，使用刚输出的路径转换：

```sh
npm run export:video -- "artifacts/capture/实际文件名.webm" hunt
npm run export:video -- "artifacts/capture/实际文件名.webm" walk
npm run media:sync
```

转换生成 H.264 / yuv420p MP4 到 `assets/videos/hunt.mp4` 或 `walk.mp4`，使用 faststart 便于网页播放。`media:sync` 将已经存在的最新验证截图复制到图册素材目录。两段视频均已在独立项目中以当前 v1.0.0 核心重新录制，行走录像关闭捕食，捕食录像开启捕食。

## 打包与迁移

```sh
npm run package
```

压缩包保存在 `dist/`，包括源码、文档、测试、照片、视频、参考图和发布摘要，排除 node_modules、Git 元数据和 artifacts 运行目录。Windows 使用 PowerShell/.NET，其他平台需要 `zip` 命令。解压后运行演示仍不必安装 npm 依赖；要运行检查则执行 `npm ci`。

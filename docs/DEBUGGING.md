# DOM 调试指南

## 1. 先用 VS Code 启动调试版
1. 在 VS Code 打开 `D:\AI-SDY\02Sign`
2. 先执行 `npm install`（如果依赖还没装）
3. 打开“运行和调试”面板
4. 选择 `Electron: Debug DOM (headful)`
5. 按 `F5`

这个配置会自动：
- 先执行 `npm run build`
- 启动 Electron
- 打开有头 Playwright 浏览器`r`n- 默认使用系统已安装的 `Microsoft Edge` 稳定版通道
- 自动打开 Electron DevTools
- 开启详细日志
- 保存 HTML 快照

## 2. 调试产物在哪里
调试模式开启后，应用会把证据写到 Electron `userData` 目录下：
- `debug-artifacts/monitor.log`
- `debug-artifacts/*.html`
- `debug-artifacts/*.txt`
- `debug-artifacts/*.json`

你也可以在应用界面点击：
- `打开调试目录`
- `打开日志文件`

## 3. 先看哪几类快照
优先看这几类文件：
- `latest-list`：目标列表页抓取结果
- `topic-<id>`：主题首页正文结构
- `cdk-<id>-before-claim`：CDK 活动页点击前结构
- `cdk-<id>-after-click`：点击领取后的页面反馈
- `manual-login-window`：Cloudflare 或手动登录页面

同名 `.json` 文件会带 URL、标题和附加元数据。

## 4. 改 DOM 选择器时看这几个函数
文件：`src/automation/monitor-service.ts`
- `extractTopicList()`：列表页前 10 条主题、标题和 tag
- `extractTopicSnapshot()`：主题首页标题、发布时间、正文链接
- `detectAuthState()`：登录态、Cloudflare 判断
- `attemptClaim()`：CDK 页按钮和结果文本

推荐顺序：
1. 先让 `latest-list` 抓对
2. 再让 `topic-<id>` 抓对
3. 再让 `cdk-<id>-before-claim` 抓对
4. 最后验证 `after-click` 的成功/失败判定

## 5. VS Code 下怎么打断点
建议打在这些位置：
- `scanLatest()` 开头：确认页面是否成功打开
- `extractTopicList()` 返回前：看 `rows` 的真实结构
- `deepReadTopic()` 中 `extractTopicSnapshot()` 后：确认正文解析结果
- `handleCdk()` 中 `parseCdkWindow()` 后：确认活动时间解析
- `attemptClaim()` 中 `button.count()` 后：确认按钮是否真的被找到

因为已经启用了 source map，断点会直接命中 `.ts` 源文件。

## 6. 一次标准 DOM 适配流程
1. 用 `Electron: Debug DOM (headful)` 启动
2. 在应用里点 `打开登录窗口` 完成登录
3. 点 `立即重扫`
4. 如果结果不对，先打开 `monitor.log`
5. 再打开对应 `.html` 快照，直接用浏览器或 VS Code 搜真实 DOM
6. 只修改一个函数里的选择器
7. 运行 `npm run build`
8. 再按 `F5` 重跑验证

## 7. 环境变量说明
调试配置来自这些环境变量：
- `LINUXDO_DEBUG=1`：启用调试日志和调试状态面板
- `LINUXDO_HEADFUL=1`：用有头浏览器运行 Playwright`r`n- `LINUXDO_BROWSER_CHANNEL=msedge`：强制使用系统 Edge；可改成 `chromium` 做对照实验
- `LINUXDO_OPEN_DEVTOOLS=1`：自动打开 Electron DevTools
- `LINUXDO_SAVE_HTML=1`：保存页面 HTML/TXT/JSON 快照
- `LINUXDO_VERBOSE_LOGS=1`：输出更细的流程日志

`Electron: Debug DOM (headful)` 已经帮你全部打开了。

## 8. 最常见的定位方法
- 列表抓不到：先看 `latest-list.html`
- 进帖后读不到正文：看 `topic-<id>.html`
- 被误判未登录：看 `manual-login-window.html` 或最新 `latest-list.json`
- 找不到领取按钮：看 `cdk-<id>-before-claim.html`
- 点击后状态识别不对：看 `cdk-<id>-after-click.html`

## 9. 每次改完的验证
改完选择器后至少跑：
```powershell
npm test
npm run build
```

然后再用 VS Code 的 `Electron: Debug DOM (headful)` 复现一次。

## 10. Cloudflare 退避和手动领取新策略
- 自动扫描现在会强制使用至少 180 秒的安全间隔，避免频繁刷新 latest 页触发 Cloudflare。
- 一旦扫描阶段检测到 Cloudflare，程序会暂停自动扫描 15 分钟；连续再次触发时会延长到 30 分钟。
- CDK 不再自动点击 立即领取。
- 对于未开始活动，会在开始前 3 分钟提醒；如果已经进入最后 3 分钟窗口，会立即提醒一次。
- 到开始时间后程序只会重新检测并弹窗提示你手动领取，不会替你点击，因为领取会弹出二次校验。



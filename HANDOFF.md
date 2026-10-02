# 项目交接说明

## 当前状态

项目为 Cocos Creator **3.8.8** 的中文竖屏答题原型，版本 `0.1.0`，已发布到 [alexmmog/schoolgame](https://github.com/alexmmog/schoolgame) 的 `main` 分支。

当前包含四站玩法、67 道原创开发草稿、六张集成插画及必需 `.meta`，支持二／四选项、正误文字与图标、解析、暂停／继续、本地保存、一次换题和一次失败站重整。题目仍为 `draft`，未完成独立双人审核。当前界面不调用真实广告，模拟接口不代表真实收入。

规则在 `project/assets/scripts/core`，保存与平台接口在 `project/assets/scripts/platform`，Cocos 界面在 `QuizApp.ts` 与 `ui`。生成构建、缓存和本地验证报告被 Git 忽略。后续交接与项目说明继续使用中文，保留代码标识、路径、命令和 API 名称。

## 打开、测试与构建

使用已安装的 Creator **3.8.8**，在 Cocos Dashboard 导入仓库的 `project` 子目录，打开 `assets/Main.scene`。已验证环境为 Windows、Node **24.13.0**、PowerShell **7.6.6**；脚本不会自动安装或登录。

在仓库根目录打开 PowerShell，依次执行：

```powershell
node .\tools\test.cjs
.\tools\build.ps1 -Platform web-mobile
node .\tools\verify-art-import.cjs
node .\tools\http-smoke.cjs 7348
node .\tools\serve.cjs 7348
```

测试先创建本地 `evidence` 与 `.test-dist`；构建输出为 `project/build/web-mobile`。Creator 成功退出码是 **36**，命令行构建仍依赖可运行编辑器的 GUI 环境。

最后一个命令启动本机服务，打开 **http://127.0.0.1:7348/**，Ctrl+C 停止。不要直接双击 `index.html`。安装路径调整与独立进程存档探针见 [README](README.md)。

## 已验证与未验证

以下结果来自前次发布验证；本次仅补充文档，没有重复完整测试或构建。

| 项目 | 证据与边界 |
| --- | --- |
| 自动检查 | 86 通过、0 失败、0 跳过；含规则、模拟广告、保存、容量、资产与布局计算 |
| 类型检查 | 使用实际 Creator TypeScript 5.8.2 与 `cc.d.ts`，12 个纯输入、17 个完整 Cocos 输入通过 |
| 供题容量 | 416 类失败移除、9,542 个后续状态、19,843 次转移；512 条最长规则路径通过 |
| 官方 Web 构建 | 成功退出 36；六条 SpriteFrame 路径有效，编译 PNG 与源图一致 |
| HTTP 交付 | 49 文件、17,424,739 字节，全部 200 且哈希匹配；越界请求 403 |
| 保存重启 | 两独立 Node 进程恢复成功；不能替代 Cocos／浏览器端到端重启验证 |
| 游戏屏幕与手机 | 首帧、实际按钮点击、浏览器重启、中文断行、安全区、多手机显示、内存及首载性能未测 |
| 微信与真实广告 | 本版本微信构建、开发者工具导入、真机与真实激励广告未验证；配置没有真实 AppID |
| CI | 当前仓库没有配置工作流，不把本机通过称为 CI 通过 |

详见 [验证报告](TEST-REPORT.md)、[容量证明](CAPACITY-PROOF.md)、[素材接入](ART-INTEGRATION-REPORT.md) 与 [修订记录](REVISION-NOTES.md)。资产联系表明确为非游戏截图。

## 下一步

1. 使用有实际屏幕与输入能力的授权环境，验证首页、地图、二／四选项正误、暂停／继续和浏览器关闭重开。
2. 核对手机中文排版、安全区、首载时间和内存，再扩充与独立审核题包。
3. 后续微信／IAA 验证使用用户自有并授权的 AppID、广告位和账户；先做本地构建与导入，不提前声称真机、广告或发布通过。

当前主引擎可继续使用 Cocos；原型验证通过不等于发布验收。

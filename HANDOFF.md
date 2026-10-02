# 项目交接说明

## 当前状态

项目为 Cocos Creator **3.8.8** 的中文竖屏答题原型，版本 `0.2.0`。本轮变更仅在本地整合，尚未推送远端。

当前包含四站玩法、67 道原创开发草稿、六张集成插画及必需 `.meta`，新增题目难度递进、最近两局抽题偏好和按题包隔离的当前局保存，支持二／四选项、正误文字与图标、解析、暂停／继续、本地保存、一次换题和一次失败站重整。题目仍为 `draft`，未完成独立双人审核。当前界面不调用真实广告，模拟接口不代表真实收入。

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

v0.2 的自动检查覆盖规则、近期历史、双槽保存、实际 QuizApp 保存入口、容量与资源。测试数量及桌面浏览器结果见验证报告。引擎类型检查为 15 个纯输入、20 个完整输入。

旧版 Windows 官方 Web 构建和 HTTP 交付记录是历史证据；本轮未重建发布包。手机安全区、内存、首载性能、微信开发者工具与真机、真实广告均未验证。当前仓库没有 CI 工作流。

macOS 测试命令见 README。灰屏排查先确认 Dashboard 导入的是 `project`，而非仓库根目录。本机编辑器预览地址为 [localhost:7457](http://localhost:7457/)。

详见 [验证报告](TEST-REPORT.md)、[容量证明](CAPACITY-PROOF.md)、[素材接入](ART-INTEGRATION-REPORT.md) 与 [修订记录](REVISION-NOTES.md)。资产联系表明确为非游戏截图。

## 下一步

1. 在真实手机上验证长题、中文排版、安全区、首载时间与内存。
2. 对 v3 草稿开展独立人工双审，之后继续扩题以增加重玩差异。
3. 后续微信／IAA 验证使用用户自有并授权的资料，先做本地构建与导入。

当前主引擎可继续使用 Cocos；原型验证通过不等于发布验收。

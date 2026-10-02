# 这题我来 · 生活漫画答题试玩

Cocos Creator **3.8.8** 的独立竖屏中文答题原型，版本 `0.1.0`。四站生活情境、67 道原创开发草稿，包含二／四选项、明确正误文字与图标、解析、暂停／继续、本地保存与失败站重整。题库尚未完成独立双人审核，本项目处于开发验证阶段。

## 打开项目

需要已安装的 Cocos Creator **3.8.8**。本轮验证使用 Windows、Node **24.13.0**、PowerShell **7.6.6** 和 Creator 内置 TypeScript **5.8.2**；脚本不会自动安装软件、登录或下载 npm 依赖。

1. 克隆本仓库。
2. 在 Cocos Dashboard 导入 `project` 子目录，选择 Creator 3.8.8。
3. 打开 `assets/Main.scene`，使用编辑器预览。

仓库包含源码、六张最终 PNG、全部 Cocos `.meta`、场景与设置，不附带已生成的构建包或缓存。

## 测试、构建与本机访问

在仓库根目录打开 PowerShell，依次执行：

```powershell
node .\tools\test.cjs
.\tools\build.ps1 -Platform web-mobile
node .\tools\verify-art-import.cjs
node .\tools\http-smoke.cjs 7348
node .\tools\serve.cjs 7348
```

打开 **http://127.0.0.1:7348/**。服务只监听本机，Ctrl+C 停止。不要直接双击 `index.html`；Cocos 模块需要通过 HTTP 加载。若端口被占用，可改传另一端口；不同端口属于不同存档来源。

测试先创建本地 `evidence` 和 `.test-dist`，再由构建输出到 `project/build/web-mobile`。这些目录都不纳入 Git。Creator 成功构建退出码为 **36**；构建仍需可运行本机 Creator 的 GUI 环境。

默认安装根目录为 `C:\ProgramData\cocos\editors\Creator\3.8.8`。安装位置不同时：

```powershell
$env:COCOS_CREATOR_ROOT = 'D:\Cocos\Creator\3.8.8'
node .\tools\test.cjs
.\tools\build.ps1 -Platform web-mobile -CreatorExe 'D:\Cocos\Creator\3.8.8\CocosCreator.exe'
```

路径应指向已经安装的同一版本；示例路径不会触发安装。

两独立进程存档探针（先完成测试，使用不存在的新输出路径）：

```powershell
node .\tools\run-restart-probe.cjs write evidence\my-new-restart-probe.json
node .\tools\run-restart-probe.cjs read evidence\my-new-restart-probe.json
```

它验证注入式 Node 文件存储；浏览器关闭重开需另外实测。

## 玩法与保存

- 四站目标分别为 3／4／4／5 次正确；每站从容 3 格，错误或超时减 1，正确不回血。
- 选择答案立即提交；新题和解析各有 350 ms 防连点，重复／旧题／迟到提交拒绝重复结算。
- 正确基础分 100，连对附加 0／10／20，过幕 `200 + 50 × 剩余从容`；全对总分 3200。
- 同局一次免费换题和一次失败站重整；题 ID／事实簇不重复。中间站选择路线，前两道已结算题兑现路线承诺，互联网题不连续。
- 暂停收起题面并冻结时间；恢复题中存档或从后台返回后需要明确继续，不补算离线时间。
- 存档使用双槽校验、写后核对及损坏回退；不兼容版本受到保护，不自动覆盖。摘要不是防作弊机制。

## 代码和素材

| 路径 | 内容 |
| --- | --- |
| `project/assets/scripts/core` | 可独立测试的题包、规则、状态与容量证书 |
| `project/assets/scripts/platform` | 可注入保存、生命周期与模拟激励广告接口 |
| `project/assets/scripts/ui` | 原生 Cocos UI、布局及生成图片加载 |
| `project/assets/scripts/QuizApp.ts` | 运行界面与流程 |
| `project/assets/resources/draft-bank.json` | 67 道原创 `draft` 题 |
| `project/assets/resources/art` | 透明主角、街区地图和四场景及必需元数据 |
| `art-source/asset-manifest.json` | 最终 PNG 尺寸、alpha、SHA-256 与预算记录 |
| `tests`、`tools` | 规则、模拟广告、保存、容量、资产检查及构建工具 |

六张图片为新生成的生活漫画资产。各章复用同一张透明主角 Sprite；题目、站点文字、锁／勾、按钮与正误反馈均为原生实时 UI。PNG 合计 **11,136,977 字节**，全部 RGBA8 估算 **37,760,080 字节**；实际移动端内存尚未测。

下图是**资产联系表，不是游戏运行截图**：

![资产联系表 · NOT GAMEPLAY](docs/assets-contact-sheet-NOT-GAMEPLAY.png)

## 验证与范围

规则、API 类型及资产检查 **86／86** 通过；容量证明覆盖 416 类失败移除、9,542 个后续状态和 512 条最长运行路径。官方 Web 构建及六张 PNG 导入已通过。详见 [验证报告](TEST-REPORT.md)、[容量证明](CAPACITY-PROOF.md)、[资产接入](ART-INTEGRATION-REPORT.md) 和 [修订记录](REVISION-NOTES.md)。

实际屏幕首帧、真实 UI 点击、浏览器重启、中文断行、安全区和多手机显示仍未实测。表情组暂缓。当前 UI 不调用广告；模拟回归不代表真实广告或收入。

本版本未完成微信目标构建、开发者工具导入或真机验证。保留空 AppID 的未来构建配置，不包含账户、广告位或凭据；后续真实微信／IAA 需要用户自有授权资料。本次没有上传微信或公开部署游戏网站。

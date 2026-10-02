# 生活漫画插画接入

六张新生成 PNG 的原始像素已检查，原字节与 SHA-256 保存在资产清单。透明主角、街区地图和四章场景已接入真实 Cocos Sprite；背景没有人物或功能文字，主角在各章复用同一图，动态题卡、站点状态及按钮保持原生 UI。

`ComicArt.ts` 启动加载六个资源并持有至应用销毁。`ComicUI.ts` 按原图比例 fit，trim=false，线性 min／mag、无 mipmap、clamp-to-edge、packable=false。源 `.meta` 持久化这些设置。

此前官方 Web 构建核对六条 `art/<name>/spriteFrame` 资源路径及实际尺寸，六张编译 PNG 与源 PNG 完全一致。可以在构建后重新运行 `node tools/verify-art-import.cjs`，报告生成于本地忽略的 `evidence/art-import-verification.json`。

图片合计 11,136,977 字节；全部 RGBA8 估算 37,760,080 字节。单屏主角加背景约 12.6 MB 是绘制纹理估算，不是进程内存；手机性能、实际首载时间和 GPU 峰值未测。

六图像素与联系表已查看。新图引用编辑因 Windows 路径参数反序列化失败而暂缓表情组，未绕过失败路线或替换为不同角色。真实游戏首帧、按钮输入和手机排版尚未实测。

`docs/assets-contact-sheet-NOT-GAMEPLAY.png` 只展示实际资产，不能作为游戏运行截图。运行说明见 README，规则／存档七项修复保持不变。

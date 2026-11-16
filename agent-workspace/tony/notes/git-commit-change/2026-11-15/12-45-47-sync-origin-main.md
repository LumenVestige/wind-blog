# 推送前同步远程 main 的文章样式和彩色高亮改动

时间：2026-11-15 12:45:47

## Outcome

推送本地 AgentDevWorkSpace 改动前，发现远程 main 已新增三笔提交。通过普通合并保留双方提交，未发生冲突；远程改动包括文章正文字号、文楷粗体以及 Obsidian 彩色高亮支持和色块标记隐藏。

## Verification

- `npm test -- tests/unit.test.ts`：26 项测试全部通过。
- `git diff --check` 通过。
- 未进行浏览器视觉检查。

## Git 提交

```
6ac2c48 [fix] 隐藏彩色高亮的色块标记
80b9e00 [fix] 支持 Obsidian 彩色高亮
4df37bf [fix] 调大文章正文字号并增强文楷粗体
```

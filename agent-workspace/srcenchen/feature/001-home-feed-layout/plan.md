# 首页单列与双列布局：方案

关联：[spec.md](spec.md)

## 方案概述

沿用外观模块及其版本控制，新增 `homeLayout: 'double' | 'single'`，存入现有 `site_settings.home_layout`。缺失或未知存储值按双列读取，旧客户端省略字段时保留原值；写入时严格校验枚举，并沿用设置事务，拒绝无效请求和旧版本。

首页 SSR 与 JSON 复用的 `homePageData` 返回布局，文章网格按数据设置列数。博客 shell 同时提供布局给首页加载占位；768px 以下保持单列，宽屏读取列数变量。保持卡片、侧栏、分页和导航原有逻辑，不新增路由或依赖。

## 改动范围

- 设置：共享布局枚举、`admin-settings.ts`、`manage-settings.ts`、后台外观表单。
- 博客：`page-data.ts`、`blog-page.ts`、`shell-types.ts`、站点 layout、Mizuki shell、首页网格与 `blog-mizuki.css`。
- 接口：现有 `/api/manage/settings` 的 appearance.values 新增 homeLayout；现有 `/api/blog/page` 的首页数据新增 homeLayout，无新增接口，不修改插件接口。
- 数据格式：使用现有键值表，无 schema 修改；不写默认值也能保持双列。回退实现后新增键被旧代码忽略。
- 验证与文档：扩展管理设置、首页 JSON 和 SSR 数据测试，并运行已有首屏与 JSON 预取测试；README、独立 Note、完成总结。浏览器列数和加载占位验证原已计划，按用户后续「不测试了，commit push」要求跳过。

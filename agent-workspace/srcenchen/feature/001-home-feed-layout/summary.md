# 首页布局设置完成说明

后台「站点设置 → 外观」可保存双列或单列首页文章列表，默认双列，768px 以下均使用单列。设置存于 `site_settings.home_layout`，沿用模块事务、版本控制和鉴权，旧请求缺省字段时保留当前选择，无数据库迁移。

首次 SSR 与后续 JSON 导航均携带布局；shell 为加载占位提供相同列数，首页卡片使用对应数据，不改变侧栏和文章页。

已执行：`npm test -- tests/manage.test.ts tests/blog-page-api.test.ts tests/blog-first-paint.test.ts tests/blog-json-prefetch.test.ts`（4 个文件、28 项通过），`npm run typecheck` 通过。

按用户「不测试了，commit push」要求停止后续验证。原计划的真实浏览器操作、视觉列数与占位验证未执行，未运行生产构建。临时开发服务已停止，数据库和运行环境不提交。

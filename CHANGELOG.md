# 更新日志

`dsh-model-context-catalog` 的重要变更均记录在此。每个正式版本必须保留一个
`## X.Y.Z` 小节；发布流水线会提取该小节作为 Release Notes，并拒绝发布缺少对应小节的版本。

## 0.2.0

首次 npm 发布。修复自定义模型路由上的 `pi-ai detected context overflow …` 误报：
pi-ai 适配器会为未声明容量的路由生成 262,144 tokens 猜测兜底
（`DEFAULT_CONTEXT_WINDOW`），静默溢出启发式又把这个猜测当成真实限制。结果是成功的长上下文
`stop` 回合被重新分类为 `CONTEXT_WINDOW_EXCEEDED`——工具循环继续工作，但最终回答失败；
`/compact` 因复用同一路由生成摘要，也会以相同原因失败。

插件为精确路由声明真实容量，并通过公开 Settings API 将其同步进 `llm-pi-ai`。完整证据和
上游代码锚点见 [`ROOT_CAUSE.md`](./ROOT_CAUSE.md)。

- **忠实显示模型名称**：设置页模型选择器原样显示已配置名称，包括 `(Agent Plan)` 等后缀；
  只有名称不存在时才使用模型 ID。套餐后缀可参与搜索，绝不改写。
- **按 provider 分组的模型组合框**：sticky 分组标题同时显示展示名称、原始 provider key
  和模型数量；支持按 provider、名称和 ID 搜索；支持 ArrowUp/Down、Home/End、Enter、
  Escape，并提供完整 ARIA listbox 语义。
- **诚实显示容量状态**：模型行显式配置显示为 **已生效**；provider 默认值显示为
  **提供方默认容量**，仅在悬浮时显示数值。适配器的 262,144 兜底不会被展示为真实限制。
  其他状态包括：**等待同步**、**未配置此路由**、**已停用**。
- **服务状态提示**：增加目录不可用、只读、已配置模型列表不可用三类通知；只读模式会禁用
  添加和保存。
- **同步加固**：使用 revision CAS 和有限冲突重试；始终保留无关 `llm-pi-ai` 字段及路由；
  目录不可读时不会修改 `llm-pi-ai`。
- **打包与分发**：加入 `engines >= 22`、`publishConfig`、`repository` 元数据；CI 覆盖
  Node.js 22/24 和 `dsh-plugin-checker`；通过 GitHub Actions + npm Trusted Publishing
  （OIDC）按 tag 发布，启用 `--provenance`、tarball 边界检查和逐版本 CHANGELOG 守卫。

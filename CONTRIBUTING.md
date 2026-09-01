# Contributing

感谢参与 `dsh-model-context-catalog`。

## 开发环境

- Node.js `>= 22`
- npm
- DeepSeek Harness `>= 0.1.1-rc.2`

```bash
npm install
npm run check
npm test
npm pack --dry-run
```

`npm run check` 会重新生成 `lib/`、验证构建产物和包边界，并运行轻量静态检查。
提交前必须保证全部命令通过。

## 代码结构

- `index.js`：Host 插件、Settings namespace 和同步控制器
- `catalog.js`：目录数据与 `llm-pi-ai` 最小补丁规划
- `client.js`：Web 设置页面
- `lib/`：由 `npm run build` 生成的发布产物
- `test/`：目录、Host、UI 和包契约测试
- `scripts/`：构建、lint 和 bundle 验证脚本

请修改根目录源文件，不要直接编辑 `lib/`。

## 贡献规则

### 路由与容量

- 使用精确的 `(provider, model)` 路由，不把不同网关视为同一部署。
- `contextWindow` 必须是正安全整数，并有服务商文档或实际部署证据。
- 不得把 262,144 的 adapter fallback 当成真实容量。
- 同步时必须保留名称、endpoint、协议、凭据引用和其他未知字段。
- 当前不维护 `maxTokens`。

### 模型选择器

- 新建列表只来自 resolved `llm-pi-ai` 中已经配置的模型。
- 不合成不存在的路由。
- `model.name` 必须原样显示；仅在缺失时回退到 `model.id`。
- 不得删除或改写 `(Agent Plan)` 等后缀。
- 保持 provider displayName、provider key、搜索、键盘和 ARIA 行为可用。

### 测试

任何行为变化都需要对应回归测试。特别需要保护：

- 精确路由匹配；
- revision 冲突重试与最小补丁；
- 模型名称忠实显示；
- 构建产物与源码同步；
- npm 包文件边界。

## 文档分工

- `README.md`：解决的问题、安装和使用方法
- `ROOT_CAUSE.md`：会话证据、代码路径和根因分析
- `CONTRIBUTING.md`：开发流程与维护约束
- `CHANGELOG.md`：版本变化和 Release Notes

文档应简洁，避免在多个文件重复同一段内容。

## Pull Request 检查清单

- [ ] 变更范围单一且说明清楚
- [ ] `npm run check` 通过
- [ ] `npm test` 通过
- [ ] `npm pack --dry-run` 只包含预期文件
- [ ] 行为变化有测试
- [ ] 用户可见变化已更新 README 或 CHANGELOG



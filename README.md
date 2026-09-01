# dsh-model-context-catalog

为 DeepSeek Harness（DSH）的 `llm-pi-ai` 模型维护准确的路由级
`contextWindow`，避免长会话被错误判定为上下文溢出。

- DSH：`>= 0.1.1-rc.2`
- Node.js：`>= 22`
- 仓库：[`HOWILLMAKEIT/dsh-model-context-catalog`](https://github.com/HOWILLMAKEIT/dsh-model-context-catalog)
- 协议：MIT

## 解决什么问题

自定义模型路由未声明上下文窗口时，DSH/pi-ai 会使用 262,144 tokens 的兜底值。
当实际请求超过这个猜测值时，服务端即使成功返回，也可能被重新分类为：

```text
pi-ai detected context overflow for model "glm-5.3-flash"
```

这会导致两种典型现象：

- 工具调用可以继续，但最终自然语言回答失败；
- `/compact` 使用同一路由生成摘要，也被误判为溢出，压缩无法提交。

本插件按精确的 `provider/model` 路由写入正确的 `contextWindow`，并通过 DSH
公开 Settings API 同步到 `llm-pi-ai`。它不修改 DSH/pi-ai 内部代码，也不接管
provider 凭据。

完整证据和上游代码路径见 [`ROOT_CAUSE.md`](./ROOT_CAUSE.md)。

## 安装

### 从 npm 安装

```bash
dsh plugin --profile web add dsh-model-context-catalog
```

### 从本地目录安装

```bash
dsh plugin --profile web add /absolute/path/to/dsh-model-context-catalog
```

安装后刷新 DSH Web 页面；如果 Host 尚未加载插件，请重启 DSH Host。

## 使用

1. 打开 **设置 → 上下文窗口**。
2. 点击 **添加模型**。
3. 从已经配置的 `llm-pi-ai` 模型中选择路由。
4. 输入该部署真实支持的上下文窗口，可选填写备注。
5. 保存并确认状态变为 **已生效**。

模型选择器会原样显示 provider 和模型信息，包括 `(Agent Plan)` 等套餐后缀。
相同模型经不同 provider 或网关部署时，应分别配置。

> 上下文窗口必须以对应服务商文档或控制台为准。配置过小会继续造成误报；配置过大
> 可能掩盖真实溢出。

## 行为边界

- 仅处理 `llm-pi-ai` 中已经配置的模型，不合成不存在的路由。
- 仅维护 `contextWindow`，不写入未经验证的 `maxTokens`。
- 只更新目标模型的上下文窗口，保留名称、endpoint、协议、凭据引用和其他字段。
- provider 默认值只作为默认值显示，不会冒充模型的真实容量。
- 已删除路由的旧目录条目仅在编辑自身时回显，方便清理。

## 开发

```bash
npm install
npm run check
npm test
npm pack --dry-run
```

贡献规范见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)，版本记录见
[`CHANGELOG.md`](./CHANGELOG.md)。

## License

[MIT](./LICENSE)

# `pi-ai detected context overflow` 根因分析

## 结论

在本次调查的长会话中，错误：

```text
pi-ai detected context overflow for model "glm-5.3-flash"
```

并不是 GLM 服务端拒绝了请求，而是 **DSH/pi-ai 用猜测的 262,144 tokens 窗口，
将服务端已经成功返回的 `stop` 响应重新分类为上下文溢出**。

同一个错误窗口也被 `/compact` 的摘要请求使用，因此普通回答和压缩会同时失败。

## 故障链

### 1. 未声明容量时使用猜测值

`llm-pi-ai` 为模型物化 `contextWindow`。模型行和内置目录都没有匹配值时，使用：

```text
DEFAULT_CONTEXT_WINDOW = 262144
```

这个值是适配器兜底，不是服务商确认的真实限制。

### 2. 猜测值进入静默溢出判定

pi-ai 会在成功终止的响应上检查：

```text
usage.input + usage.cacheRead > contextWindow
```

当终止原因是 `stop` 且用量超过窗口时，响应会被标记为上下文溢出。DSH 随后把它
转换为合成错误 `pi-ai detected context overflow …`。

因此，只要真实模型窗口大于 262,144，而配置仍使用兜底值，就可能出现假阳性。

### 3. 为什么工具调用成功，最终回答失败

这条用量判定作用于最终 `stop` 响应；`toolUse` 响应不走同一分支。因此长工具循环可以
持续执行，但最后的自然语言回答会被丢弃。

已验证的判定结果：

| 响应用量 | 传入窗口 | 终止原因 | 结果 |
| --- | ---: | --- | --- |
| 724,675 | 262,144 | `stop` | 被判定为溢出 |
| 724,675 | 1,000,000 | `stop` | 正常 |
| 724,675 | 262,144 | `toolUse` | 正常 |

### 4. 为什么 `/compact` 也失败

`compaction-basic` 默认使用最近一次路由模型生成摘要。摘要请求仍携带错误的
262,144 窗口，因此生成成功后的 `stop` 响应会再次被误判。

压缩事务随后记录 `compaction/end.error`，但不会提交 `compaction/summary`。历史记录
没有缩短，下一次 `/compact` 会重复相同失败。

## 会话证据

### `session-beb4a757-e2e9-4769-8c4e-5265fa627869`

- DSH 上下文估算：430,111 tokens；
- provider prompt 用量：544,630 tokens；
- 被记录的 GLM 窗口：262,144 tokens；
- 10 个终止回合被判定为溢出；
- 49 次压缩失败；
- 成功的 `compaction/summary`：0。

### `session-cb8ee285-0e9b-445c-91b1-d11600923df6`

- 同一模型此前在另一条路由上使用 1,000,000 tokens 窗口；
- 切换到自定义 `glm-coding` 路由后，记录值变成 262,144；
- provider 成功处理过最高 724,675 tokens 的工具调用请求；
- 7 个最终回合随后被判定为溢出。

这些数据证明 262,144 并非该部署的实际处理上限。

## 上游代码证据

调查锚定以下版本：

- DSH `dsh-v0.1.1-rc.2`：`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- DSH `dsh-v0.1.2-alpha.3`：`dd6322d604e00eec1ba5e0c8541159906a21094a`
- pi-ai `v0.82.1`：`b4f293684bba718d59cc1157679bcf6157b3a7f5`

关键路径：

1. [DSH 默认窗口 `262144`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/llm/llm-pi-ai/src/config.ts#L61)
2. [模型行 → 内置目录 → 默认值的回退链](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/llm/llm-pi-ai/src/catalog.ts#L851)
3. [`contextWindow` 被传入流转换器](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/llm/llm-pi-ai/src/stream.ts#L76-L89)
4. [pi-ai 静默溢出判定](https://github.com/earendil-works/pi/blob/b4f293684bba718d59cc1157679bcf6157b3a7f5/packages/ai/src/utils/overflow.ts#L132-L161)
5. [DSH compaction 摘要与事务路径](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/compaction/compaction-basic/src/index.ts#L179-L223)

这些行为在 `dsh-v0.1.2-alpha.3` 中仍然存在。pi 新增了
`isRecoverableLength`，但该版本 DSH 尚未使用它。

## 插件为什么有效

`dsh-model-context-catalog` 在回退链的最高优先级——模型行——声明路由级
`contextWindow`。同步后，pi-ai 收到的是该部署的实际容量，而不是 262,144 猜测值。

插件通过 DSH 公开 Settings API 更新配置，并使用 revision CAS 和有限冲突重试。它不修改：

- pi-ai 的溢出分类逻辑；
- compaction 的摘要、区间或事务实现；
- provider 错误文本；
- 模型输出上限 `maxTokens`。

## 上游应修复的部分

插件只能纠正已知路由的元数据。长期方案仍应由上游完成：

1. 区分“猜测容量”和“可信容量”的来源；
2. 不应仅凭猜测值把 provider 成功响应改写为溢出错误；
3. 保留 provider 明确返回的真实溢出错误；
4. 接入 pi 的 `isRecoverableLength`，改进有限压缩与重试；
5. 让摘要请求自身溢出时可以安全恢复，而不是永久回滚。

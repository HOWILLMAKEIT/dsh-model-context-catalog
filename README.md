# dsh-model-context-catalog

一个面向 DeepSeek Harness（DSH）的 Host + Web 插件，为已经配置的
`llm-pi-ai` 模型维护**路由级上下文窗口目录**。插件会在 token 压力检测和溢出恢复
读取模型元数据前，通过 DSH 公开 Settings API 修正错误或缺失的 `contextWindow`。

- 兼容版本：DSH `>= 0.1.1-rc.2`、Node.js `>= 22`
- 运行界面：Host（设置命名空间与自动同步）+ Web（可视化设置页）
- 开源协议：MIT
- 代码仓库：`howill/dsh-model-context-catalog`

## 解决什么问题

长期运行的自定义模型会话可能突然报错：

```text
pi-ai detected context overflow for model "glm-5.3-flash"
```

即使模型服务端已经成功处理请求，也可能被 DSH/pi-ai 判定为上下文溢出。完整故障链如下。

1. **适配器需要一个上下文窗口数值。**
   `@deepseek-ai/dsh-llm-pi-ai` 会为每个模型生成 `contextWindow`。自定义路由没有声明时，
   DSH 0.1.1-rc.2 会使用 `DEFAULT_CONTEXT_WINDOW = 262,144`。它只是猜测值，
   不是服务商的真实限制。
2. **猜测值被当成判定真值。**
   pi-ai 的静默溢出启发式会检查终止原因为 `stop` 的响应；当上报的输入与缓存读取量
   超过该窗口时，就把成功响应重新分类为 `CONTEXT_WINDOW_EXCEEDED`。DSH 最终显示
   `pi-ai detected context overflow …`。
3. **工具调用正常，最终回答失败。**
   这条启发式分支只检查最终自然语言响应，不检查 `toolUse` 结束。因此长工具循环可以持续
   工作，但最后的自然语言回答会被误判并丢弃。
4. **`/compact` 也会因此失效。**
   压缩默认使用最近一次路由模型生成摘要。摘要请求通常也超过错误的 262,144 限制；摘要
   虽然可能已经由服务端生成，但终止响应再次被误判，事务写入
   `compaction/end.error`，不会提交 `compaction/summary`。历史记录没有缩短，重试会重复
   同一循环。

## 如何修复

修复方式是为每个精确路由提供真实、部署相关的上下文窗口。

本插件会：

1. 在独立的 `model-context-catalog` 设置命名空间中保存路由容量；
2. 按精确的 `provider/model` 组合查找条目；
3. 通过 DSH 公开 `settings.update` API 把容量同步到 resolved `llm-pi-ai` 配置；
4. 让 pi-ai 自带的 settings watcher 原子重建适配器快照。

插件不会 monkey-patch DSH/pi-ai，不修改溢出分类器，也不修改 compaction 的事务和区间策略。

真实故障会话、token 测量和 GitHub 上游源码证据参见
[`ROOT_CAUSE.md`](./ROOT_CAUSE.md)。

## 主要功能

- 注册独立的 `model-context-catalog` 设置命名空间。
- 在 **设置 → 上下文窗口** 中添加、编辑、启用、停用和删除路由元数据。
- 按精确的 `provider/model` 路由匹配；相同模型经不同网关部署时可配置不同容量。
- 使用 revision CAS 和最多 3 次冲突重试，避免并发写入覆盖用户的新配置。
- 只修正目标模型的 `contextWindow`，保留 endpoint、凭据引用、协议、模型名称、输入模态、
  输出限制、兼容性标志和未知模型。
- 外部修改 `llm-pi-ai` 后自动重新检查并收敛。
- 诚实区分容量来源：
  - 模型行显式配置的值显示为 **已生效**；
  - provider 级默认值显示为 **提供方默认容量**，悬浮后才能看到数值，不会冒充真实窗口。
- 新建模型列表只来自 resolved `llm-pi-ai` 中已经配置的模型，不合成不存在的行。
- 已持久化但路由后来被删除的孤儿条目，仅在编辑自身时回显，方便用户修改或删除。

## 设置页面

打开 **设置 → 上下文窗口**。

### 添加模型

点击 **添加模型** 后：

1. 从已经配置的模型中选择目标路由；
2. 输入大于 0 的整数上下文窗口；
3. 可选填写备注；
4. 保存后等待状态变为 **已生效**。

### 模型选择器

- 按 provider 分组；
- 分组标题同时显示 provider 展示名称、原始 provider key 和模型数量；
- 支持搜索 provider、模型名称和模型 ID；
- 支持 `↑`、`↓`、`Home`、`End`、`Enter`、`Escape`；
- 模型名称始终原样显示，包括 `(Agent Plan)` 等套餐后缀，不隐藏、不改写。

### 状态标记

- **已生效**：模型行中存在与目录一致的显式容量；
- **等待同步**：已配置该路由，但容量尚未同步；
- **未配置此路由**：当前 resolved `llm-pi-ai` 中不存在该路由；
- **提供方默认容量**：只能看到 provider 默认值，不能视为真实模型限制；
- **已停用**：目录条目存在，但不参与同步；
- **内置 / 自定义**：区分插件内置条目与用户新增条目。

点击某行的 **编辑** 后，编辑器会直接在该行下方展开。自定义条目可以删除；内置条目可以
停用或覆盖，并始终可以恢复。

当目录命名空间不可用、页面只读或模型列表读取失败时，页面会显示对应提示并禁用写入。

## 安装

### 从 npm 安装

发布 0.2.0 后推荐使用：

```bash
dsh plugin --profile web add dsh-model-context-catalog
```

### 从本地目录安装

```bash
dsh plugin --profile web add /absolute/path/to/dsh-model-context-catalog
```

Host 加载新插件后刷新当前 DSH Web 页面。仅修改客户端代码时通常只需刷新；修改 Host
命名空间或 schema 后需要重启 DSH Host。

## 常见问题

### 安装后仍然出现 overflow 怎么办？

检查对应路由的状态必须是 **已生效**，而不是 **提供方默认容量** 或 **未配置此路由**。
路由必须精确匹配，例如：

```text
glm-coding/glm-5.3-flash
zai-coding-cn/glm-5.3-flash
```

这是两个不同路由。修正后重新执行失败请求；此前已经被丢弃的回答或历史不会自动恢复。

### 262,144 是模型的真实窗口吗？

不是。它是未声明容量时的 pi-ai 适配器猜测兜底。真实容量与模型、网关、套餐和部署有关。
我们验证的 GLM Coding Plan 路由可处理约 1,000,000 tokens，但其他部署必须以对应服务商
文档或控制台为准。

### 为什么模型名称中保留 `(Agent Plan)`？

因为设置页遵循忠实显示原则。后缀来自真实配置，是定位 provider/套餐的重要信息；插件不会
擅自删除或改写。

### 支持非 pi-ai provider 吗？

不支持。当前作用范围仅为 `llm-pi-ai` 设置命名空间及其路由。

### Vision Router 路由需要单独配置吗？

通常不需要。例如 `glm-coding-vision` twin adapter 会把 `resolveModel()` 委托给
`glm-coding` 基础路由，并继承上下文元数据。

### 能自动发现所有模型的官方窗口吗？

不能。请根据该部署的服务商文档或控制台填写真实数值。两个方向的错误都有风险：

- 数值过小：成功回答会被误判，触发无意义的压缩和回答丢失；
- 数值过大：真实溢出可能无法通过用量启发式识别，只能依赖错误文本兜底。

## 项目结构

```text
index.js            Host 设置命名空间与自动同步控制器
catalog.js          路由目录与 llm-pi-ai 最小补丁规划器
client.js           React/Cordis 设置页面
scripts/build.mjs   确定性生成可发布的 lib/
scripts/lint.mjs    零依赖静态检查与忠实显示回归门禁
scripts/verify-bundle.mjs
                    构建产物、客户端模块和 npm 包边界检查
test/               19 项 node:test：目录、schema、并发、客户端与包契约
.github/workflows/  ci.yml 与 release.yml
docs/release.md     npm Trusted Publishing/OIDC 发布手册
```

## 开发与测试

```bash
npm install
npm run build
npm run check
npm test
npm pack --dry-run
```

`npm run check` 会执行构建、bundle smoke 和静态检查。CI 会在 Node.js 22/24 上运行相同门禁，
并将社区 `dsh-plugin-checker` 作为硬门禁运行。

详细贡献规范参见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 发布

发布由版本 tag 驱动，使用 **npm Trusted Publishing（OIDC）**，不保存长期
`NPM_TOKEN`。

1. 更新 `package.json` 中的 `version`；
2. 在 [`CHANGELOG.md`](./CHANGELOG.md) 添加精确的 `## X.Y.Z` 小节；
3. 推送版本 tag：

   ```bash
   git tag -a vX.Y.Z -m "release vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. GitHub Actions 自动校验 tag 与版本、CHANGELOG、可复现构建、测试和 tarball 边界；
5. 通过 OIDC 执行 `npm publish --provenance`，随后创建 GitHub Release。

不要在本地直接执行 `npm publish`。首次配置、Trusted Publisher 四元组和紧急回退方案参见
[`docs/release.md`](./docs/release.md)。

## 安全与限制

- 插件不访问网络、不包含遥测。
- Host 仅通过 DSH 公开 Settings API 读写配置；Web 侧只绑定现有 settings scopes。
- 插件不接管 provider 凭据，已有凭据引用会原样保留。
- 漏洞请通过 GitHub Security Advisory 私密报告，参见 [`SECURITY.md`](./SECURITY.md)。
- 只会修正目录中明确声明的路由；未声明路由继续使用上游兜底，并保留假溢出风险。
- 容量必须来自对应部署的服务商文档或控制台；没有证据时不会宣称某个数值是“官方限制”。
- 当前只维护 `contextWindow`，不会写入未经逐模型验证的 `maxTokens`。

## 许可证

[MIT](./LICENSE)

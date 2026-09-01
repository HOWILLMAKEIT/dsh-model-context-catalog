# 发布手册：tag 驱动的 npm Trusted Publishing

本包（`dsh-model-context-catalog`）通过 GitHub Actions + npm Trusted Publishing/OIDC
自动发布，**全程不使用长期 NPM_TOKEN**。发布凭证来自 GitHub Actions 的 OIDC 身份，
由 npmjs.com 上登记的 Trusted Publisher 授权。

发布流水线定义在 [`.github/workflows/release.yml`](../.github/workflows/release.yml)。

```
git tag vX.Y.Z && git push origin vX.Y.Z      ← 唯一的发布动作
        │
        ▼
GitHub Actions (tag push)
  ├─ npm ≥ 11.5.1 断言（Trusted Publishing 最低要求）
  ├─ tag 与 package.json version 强比对（不一致 → fail-fast）
  ├─ CHANGELOG.md 存在且含 ## X.Y.Z 小节（缺失 → fail-fast）
  ├─ 重复版本预检（npm view 已存在 → fail-fast；registry 侧也会硬拒绝）
  ├─ npm ci → npm run check → npm test
  ├─ npm pack --dry-run --json 边界断言（必备文件在、node_modules/.env/test 等不在）
  ├─ npm publish --provenance   （OIDC 授权；prerelease 进 dist-tag next，稳定版进 latest）
  ├─ 发布后复核：npm view … version dist-tags dist.attestations
  └─ GitHub Release 创建（幂等：已存在则跳过；Notes 取自 CHANGELOG 对应小节）
```

## ⚠️ 首次发布前的必做配置

### 0. 发布来源仓库（已确认）

发布仓库已确定为独立公开仓库 **`HOWILLMAKEIT/dsh-model-context-catalog`**，
`package.json` 的 `repository.url` 已写入：

```
git+https://github.com/HOWILLMAKEIT/dsh-model-context-catalog.git
```

provenance 要求该字段与实际发布来源仓库一致，不一致会被 npm 拒绝发布
（fail-closed，这是刻意设计）。若将来仓库改名或转移，必须同步更新此字段，
并在 npmjs.com 的 Trusted Publisher 登记中同步修改。

> 仓库形态：发布仓库应是**只包含本插件内容的独立仓库**（`.github/` 位于仓库根）。
> 不要把包含无关内容的巨型 monorepo 作为发布来源。

### 1. GitHub 侧

1. 把插件内容推送到 `HOWILLMAKEIT/dsh-model-context-catalog`，确保
   `.github/workflows/release.yml` 已在默认分支（tag push 触发时执行的是
   **tag 指向 commit** 上的 workflow 文件，因此 workflow 必须先合入、后打 tag）。
2. Settings → Environments → New environment：`release`（与 workflow 的
   `environment: release` 及 npm 登记项一致）。
   **已确认：该 environment 不启用 Required reviewers。** 这意味着信任边界
   完全落在 npm Trusted Publisher 四元组 + GitHub 权限上——任何能向该仓库
   默认分支提交或打 tag 的人都能触发发布。建议至少保留两项零成本加固：
   Deployment tags 限制为 `v*`、release tag 禁止 force-push。
3. 首发版本已确认为 `0.2.0`（即当前 `package.json` 版本；npm 上该版本号
   尚未被占用），首次发布打 `v0.2.0` tag。

### 2. npm 侧（npmjs.com）

1. 发布账号开启 2FA。
2. 若包从未发布过：优先在 npmjs.com 用 "Add a new package" 直接占名（无需上传
   tarball）；若账号类型不支持占名，则由维护者**本机**执行一次首发：
   `npm publish`（按提示输入 OTP），之后立刻转入 CI 路径。
3. 包页面 → Settings → Trusted Publisher → 填写：
   - Platform：`GitHub Actions`
   - Repository owner：`HOWILLMAKEIT`
   - Repository name：`dsh-model-context-catalog`
   - Workflow filename：`release.yml`
   - Environment：`release`

npm 校验的是 **owner / repo / workflow 文件名 / environment** 四元组，不校验 tag
规则。本项目已确认不启用 environment required reviewers（无人工闸门），因此
务必保证：仓库协作者名单最小化、`release.yml` 的变更走 code review、
不向第三方泄露能写该仓库的权限。

## 日常发布流程

1. 修改 `package.json` 的 `version`（建议用 `npm version <patch|minor|major|pre*>`
   或手动修改），并更新 CHANGELOG 对应小节。
2. 合入主分支后打 tag 并推送（本地**永远不要**运行 `npm publish`，单一发布路径）：

   ```bash
   git tag -a vX.Y.Z -m "release vX.Y.Z"
   git push origin vX.Y.Z
   ```

3. 在 Actions 页面观察 "Release to npm"；绿了之后到 npmjs.com 确认版本、
   dist-tag 与 "Built and published from GitHub…" 的 provenance 声明。

**演练（不发布）**：Actions → Release to npm → Run workflow，`dry_run` 保持
`true`。它会完整执行除 publish/post-verify 外的所有校验（含重复版本预检）。

## 校验与守卫一览

| 守卫 | 位置 | 行为 |
| --- | --- | --- |
| npm ≥ 11.5.1 断言 | 发布 job | Node 22 自带 npm 10.x 不支持 OIDC 发布，先升级后断言 |
| tag ↔ version 一致 | 发布 job | `${GITHUB_REF_NAME#v}` 必须等于 `package.json` 的 `version` |
| CHANGELOG 小节存在 | 发布 job | `CHANGELOG.md` 必须存在且含 `## X.Y.Z` 小节，缺失即拒绝发版（对标 §9 P0；⚠️ CHANGELOG.md 尚未建立，是首发 v0.2.0 的前置硬依赖） |
| 重复版本预检 | 发布 job | `npm view <pkg>@<ver>` 命中即 **明确失败**（有意偏离对标插件的"已存在则跳过"幂等策略：错误复用旧 tag 时静默跳过会掩盖预期发布未发生；registry 侧本就硬拒绝重发） |
| registry 硬拒绝 | npm registry | 已存在的 name@version 永久不可重发（unpublish 也不释放版本号） |
| 并发锁 | workflow | `concurrency: npm-release-<ref>` 串行化同 tag 触发 |
| 构建与测试 | 发布 job | `npm ci` → `npm run check` → `npm test`（`prepack` 在 pack 时还会再跑一轮） |
| tarball 边界 | 发布 job | `npm pack --dry-run --json` 断言必备文件存在、`node_modules`/`.env`/`test`/`scripts`/`.github` 不在包内 |
| provenance | 发布步骤 | `npm publish --provenance`；发布后用 `npm view … dist.attestations` 复核 |
| GitHub Release | 发布 job | 幂等创建（已存在则跳过），Notes 从 CHANGELOG `## X.Y.Z` 小节提取 |

常规门禁见 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)：node 22/24 矩阵
跑 `npm ci` → `npm run check` → `npm test`；另接 dsh-plugin-checker
（manifest → 安装 → dump-config 三级校验），首轮以 `continue-on-error` 观察跑通后
移除该开关转为硬门禁（见 workflow 内注释）。

## 失败排查

- **OIDC 401/403**：核对 Trusted Publisher 四元组（owner/repo/`release.yml`/
  `release`）是否与 workflow 完全一致；确认 tag 指向的 commit 上存在该 workflow；
  确认没有在任何环节注入 `NODE_AUTH_TOKEN`（有 token 时 npm 不走 OIDC）。
- **tag/version 不一致**：修正后重打。删除一个**从未成功发布过**的 tag 重新打是
  允许的（先 `npm view <pkg>@<ver>` 确认不存在）；已成功发布的版本永久占用，
  只能 bump 新版本。
- **打包边界失败**：检查 `package.json` 的 `files` 字段与新增文件，不要把测试、
  脚本或本地环境文件带进 tarball。
- **发布后查不到版本**：workflow 内置 6 次 × 5s 重试；仍失败检查 npm status 页。

## 安全回退（仅当 Actions/OIDC 真正不可用时）

默认**不存在** CI 内的 token 发布路径（保持"单一发布路径"，避免自动降级掩盖
配置错误）。若 GitHub Actions 或 OIDC 暂不可用而必须紧急发版，走最小权限人工流程：

1. npmjs.com → Access Tokens → Generate New Token（Granular）：
   - Packages and scopes：仅勾选 `dsh-model-context-catalog`
   - Permissions：Read and write
   - 关联 2FA 且选择 Automation 类型；有效期 ≤ 30 天。
2. 维护者**本机**（不要入 CI）执行：

   ```bash
   npm publish --registry https://registry.npmjs.org   # 不带 --provenance（provenance 依赖 OIDC）
   ```

   输 token 或按 2FA 提示完成鉴权。发布内容应与某个已通过 CI 校验的 commit 一致
   （先在本地跑 `npm ci && npm run check && npm test && npm pack --dry-run`）。
3. **用完立即撤销该 token**，并在 issue 中记录本次紧急发版的原因与对应 commit。

之后仍以 tag 流水线为准：为同一内容补打规范 tag 是多余的（版本已占用），下一次
正常发版自然恢复流水线路径。

## 后续可选硬化

- 将 `actions/checkout`、`actions/setup-node` 升级并按 commit SHA 固定
  （对标 dsh-vision-router 的做法，见工作区 `reports/dsh-plugin-benchmark.md` §7.2）。
- ci.yml 中 dsh-plugin-checker 首轮跑通后移除 `continue-on-error` 转为硬门禁。
- README 加 release/provenance badge；发布 tag 的 Release Notes 已由流水线自动
  从 CHANGELOG 小节生成，保持该文件每版本更新即可。

> 对标依据：完整对标报告在工作区根目录 `reports/dsh-plugin-benchmark.md`
> （§7 发布基准、§9 可执行清单），不在本插件仓库内。

---
name: github-pr
description: >-
  起草、创建或更新 GitHub Pull Request 时使用。读取 .github/pull_request_template.md 并按中文规范提交 PR。
---

# GitHub PR 规则

## 1. 读取 PR 模板

起草前先读取 [`.github/pull_request_template.md`](../../../.github/pull_request_template.md)。

## 2. 标题与正文规则（中文）

PR Title：
- 格式：`<type>(<scope>): <中文简明描述>`（跨全局可省 `(<scope>)`，整行 <= 72 字符，句尾无句号）。
- `<type>`：`feat` | `fix` | `refactor` | `perf` | `test` | `docs` | `build` | `ci` | `chore` | `revert`
- `<scope>`：`frontend` | `backend` | `api` | `fullstack` | `ci` | `docs` | `deps` | `repo`
- 中文描述直指改动目的（如 `feat(backend): 新增实时语音会话 WebSocket 断线重连`），不写 "更新代码"、"修复问题" 这类空话。

PR Body：
- 保留 `.github/pull_request_template.md` 的全部二级标题（`## ...`），删掉 `<!-- ... -->` 注释并填入正文中。
- `## 测试与验证` 只写高价值验证（新增测试覆盖的边界场景、CI 覆盖不到的本地联调或手动验证结果），不要罗列 `golangci-lint`、`pnpm lint`、`pnpm build` 等 GitHub Actions 自带检查命令。

## 3. 执行步骤

1. 对比完整分支差异（不要只看最后一次 Commit）：
   ```bash
   git status --short --branch
   git log origin/main..HEAD --oneline
   git diff origin/main...HEAD --stat
   ```
2. 按改动范围跑完必要的本地检查后推送分支：`git push -u origin HEAD`。
3. 创建或更新 PR：
   ```bash
   gh pr create \
     --base main \
     --title "<type>(<scope>): <中文简明描述>" \
     --body-file - <<'EOF'
   <填充后的中文 PR Body>
   EOF
   ```
   若当前分支已有打开的 PR，改用 `gh pr edit`。
4. 验证：`gh pr view --json url,title,state,baseRefName,headRefName`。

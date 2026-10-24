---
name: git-commit
description: >-
  撰写 Git Commit Message 或执行 git commit 时使用。提供英文 Conventional Commits 模板与提交流程。
---

# Git Commit 规则

## 模板与格式（全英文）

```text
<type>(<scope>): <subject>

- <why this change is needed>
- <key technical change>

Refs #<issue_number>
```

Title 要求：
- `<type>`：`feat` | `fix` | `refactor` | `perf` | `test` | `docs` | `build` | `ci` | `chore` | `revert`
- `<scope>`（跨全局可省）：`frontend` | `backend` | `api` | `ci` | `docs` | `deps` | `repo`
- `<subject>`：英文现在时祈使句（`add`/`fix`，不用 `added`/`fixes`），首字母小写，句尾无句号，整行 <= 72 字符。

Body 与 Footer 要求：
- Title、Body、Footer 之间各空一行。
- 除单行拼写或纯格式修正外，均需写英文 Body（`- ` 列表，单行 <= 72 字符）。写清楚修改原因与关键实现，不要复述文件名或 diff。
- 关联 Issue 或破坏性变更放 Footer（`Closes #<id>` / `Refs #<id>` / `BREAKING CHANGE: ...`），无则省略。

## 执行步骤

1. 检查改动：`git status --short`、`git diff`、`git diff --staged`。
2. 原子化暂存：一次 Commit 只包含一个逻辑变更，多处独立改动拆成多次提交；不暂存 `.env`、密钥或未要求提交的构建产物。
3. 非交互式提交（禁止裸跑 `git commit` 调起编辑器）：
   ```bash
   git commit \
     -m "<type>(<scope>): <subject>" \
     -m "- <reason>
   - <change>"
   ```
4. 若 `lefthook.yml` 触发的 `golangci-lint`、`oxfmt` 或 `oxlint` 报错，修好代码并重新 `git add` 后再提交，严禁加 `--no-verify`。
5. 验证：`git log -1 --stat`。

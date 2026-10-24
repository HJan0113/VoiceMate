---
name: git-branch
description: >-
  创建、切换、重命名或清理 Git 分支时使用。定义英文分支命名规则与执行流程。
---

# Git Branch 规则

## 命名规则（英文）

格式（全小写 `kebab-case`，总长 <= 50 字符）：
- 关联 Issue：`<type>/issue-<id>-<short-slug>`
- 无关联 Issue：`<type>/<short-slug>`

允许的 `<type>`：
`feat` | `fix` | `refactor` | `perf` | `test` | `docs` | `ci` | `chore` | `hotfix`

`<short-slug>` 用 2-5 个英文单词描述改动点（如 `feat/issue-12-realtime-reconnect`、`fix/mic-stream-release`），禁用 `update`、`temp`、`dev` 等无意义词。

## 执行步骤

1. 检查工作区，隔离无关改动（`git status --short --branch`，必要时 `git stash push -u -m "<reason>"`）。
2. 同步主干并切出新分支：
   ```bash
   git fetch origin main
   git switch -c <branch-name> origin/main
   ```
   若远端不可用，用 `git switch -c <branch-name> main`。
3. 验证分支与基线：`git branch --show-current && git log -1 --oneline`。

## 约束

- 不直接在 `main` 提交代码。
- 一个分支只做一个独立任务。
- 不对 `main` 执行 `git push --force`。

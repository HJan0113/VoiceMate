---
name: github-issue
description: >-
  起草、创建或更新 GitHub Issue 时使用。动态读取 .github/ISSUE_TEMPLATE/ 下的 YAML 模板并生成中文 Issue。
---

# GitHub Issue 规则

## 1. 动态读取模板

先扫描 [`.github/ISSUE_TEMPLATE/`](../../../.github/ISSUE_TEMPLATE/) 目录（跳过 `config.yml`），按各 YAML 模板顶层的 `name` 和 `description` 匹配任务类型并读取对应文件。无法唯一匹配时先向用户确认。

## 2. 生成标题与正文（中文）

从选定的 YAML 模板提取 `title`、`labels`、`body`：

- 标题：`<模板 title 前缀><简明中文概述>`（<= 60 字符）。
- 正文：遍历 `body` 数组（跳过 `type: markdown`），将每个字段转为 `### <attributes.label>` 章节：
  - `validations.required: true` 的字段必须填实，不能留空或保留 `placeholder`。
  - `type: dropdown` 只填 `attributes.options` 里的合法值。
  - 若有预设 `attributes.value`（如步骤编号或 `- [ ]`）或 `render` 代码块类型，按原结构填入具体内容。

## 3. 执行创建

1. 先查重：`gh issue list --state all --limit 20`。已有同类打开 Issue 时直接提示用户，不重复建单。
2. 创建并打标签：
   ```bash
   gh issue create \
     --title "<模板 title 前缀><中文概述>" \
     --label "<模板 labels，逗号分隔>" \
     --body-file - <<'EOF'
   <渲染后的 Markdown 正文>
   EOF
   ```
3. 验证：`gh issue view <issue_id>`。

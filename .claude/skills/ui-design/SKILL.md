---
name: ui-design
description: >
  Invoke when the user asks about changing the look of the UI — colors, theme, layout,
  fonts, component styles, or page composition. Spawns or guides a ui-designer agent.
  Use when: "change colors", "redesign", "make it dark", "update the theme", "design",
  "style the page", "fix the layout".
---

# UI Design — How to Change the Visual Layer

This project's UI is built for design changes. React is a dumb display layer — all business logic
lives in TypeScript classes (presenters, use cases, repositories). Designers can freely change
any visual file without breaking business logic.

## Quick Reference

| Want to change... | Edit this file |
|---|---|
| Colors (entire app) | `src/ui/theme/tokens.ts` → `colors` |
| Font / sizes | `src/ui/theme/tokens.ts` → `typography` |
| Spacing / radius | `src/ui/theme/tokens.ts` → `spacing` / `radii` |
| Shadows | `src/ui/theme/tokens.ts` → `shadows` |
| Header / nav colors | `src/ui/theme/tokens.ts` → `defaultShell` |
| Layout dimensions | `src/ui/theme/tokens.ts` → `layout` |
| Component defaults | `src/ui/theme/theme.ts` → `DEFAULT_COMPONENTS` |
| Button/Card/Badge look | `src/ui/components/wrappers/{Component}.tsx` |
| Navigation structure | `src/ui/AppShell.tsx` |
| Page layout | `src/ui/presentation/{Domain}/{Page}/components/*.tsx` |

## For Agents

When spawning a design agent, use `agentType: "ui-designer"`. The agent has built-in instructions
for what to change and what not to touch.

```
Agent({ subagent_type: "ui-designer", prompt: "Change the primary color to teal..." })
```

## Architecture

```
tokens.ts (source of truth)
  ↓
theme.ts (builds component theme)
  ↓
wrappers/*.tsx (design system — Button, Card, etc.)
  ↓
presentation/*/components/*.tsx (pages — just renders vm data)
```

# 海投 OS — 因果链规格书 v3.0 (Codex 修正版)

> 版本: v3.0 (Codex 审阅+修正)
> 日期: 2026-04-09
> 状态: 待用户确认 3 个疑问点

## 待确认

- [ ] **A**: Boss 打招呼 V1 是否附简历？(Codex 说不附，用户之前说可以附)
- [ ] **B**: follow_up 是自动发送还是只生成草稿？
- [ ] **C**: target_companies 是否改名为 recommended_boards？（GH/Lever API 需要，但用户不想"猜公司"）

---

(完整 Spec 内容见 Codex 输出，包含 19 个章节：
1. Overview
2-4. Gate 决策树
5. Gate 1 - Resume Analysis (含 markitdown + Node fallback)
6. Gate 2 - Keywords + Company Seeds (含 GH/Lever target_companies)
7. Gate 3 - Discovery (含 zero-result backoff)
8. Gate 4 - Screening (advance/watch/drop/needs_context)
9. Gate 5 - Material Generation (full_tailored only)
10. Gate 6 - Submission (用 material 表的定制简历)
11. Gate 7 - Boss First Contact (走 pipeline.runFirstContact)
12. Gate 8 - Conversation Progression
13. Strategy Mode Rules (含 budget multiplier)
14. Platform Matrix
15. State Transitions
16. Timeline Events
17. Error Handling
18. Required Code Alignment
19. Final Canonical Chain)

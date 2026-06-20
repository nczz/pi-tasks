# 弱模型 Dogfood Prompt - 繁體中文

在發佈前，用真實 Pi session 搭配 `pi-tasks` 執行這些短 prompt，驗證中文任務、弱模型導引、current-step lock、evidence quality gate 與 completion gate。每段 prompt 要保持窄範圍，讓 release gate 測到 extension 行為，而不是測模型能不能一次記住很長的劇本。

## Source Extension Hardening

```text
弱模型中文 hardening dogfood。先呼叫 task_next，確認目前沒有 active task 時系統建議 task_plan。接著呼叫 task_plan，故意建立一個 invalid atomic step，step text 使用「執行測試並且更新文件」，確認 compound wording 會被拒絕。然後建立一個有效任務，名稱是「中文弱模型驗證」，包含一個 acceptance criterion 和兩個真正 atomic plan steps；不要手動填 criterionIds；每個 step 只能有一個動作、一個 expected output、一個 verification method，allowedActions 使用 ["task_evidence"]，且不要使用「並且」「然後」這類複合詞。接著故意呼叫 task_evidence，把 step_ids 指到未來步驟 T1-S2；請提供完整 quality fields，包括 source、verifier、reproducible=true、artifactRefs、observedOutput，確保這次測到的是 current-step lock 拒絕。再故意呼叫 task_evidence，使用超過 501 字的 summary，確認 evidence budget 會拒絕。最後呼叫 task_next 和 task_list，不要 include_evidence，回報 exact rejection 與唯一建議的 next tool。
```

## Installed Package Smoke

```text
已安裝套件弱模型 smoke。先呼叫 task_next，確認沒有 active task 時建議 task_plan。接著呼叫 task_plan，故意建立一個 invalid atomic step，step text 使用「執行測試並且更新文件」，回報 compound wording 是否被拒絕，以及 structured recovery 是否包含 retry_with 和 do_not_retry_same_call。
```

預期觀察：

- 「執行測試並且更新文件」這類複合步驟會被 plan quality gate 拒絕。
- `task_next` 會回傳唯一建議下一個工具、最低必要參數、禁止工具與 current-step lock。
- 掛到未來步驟的 evidence 會被拒絕，除非提供明確 override reason。
- 過長 evidence summary 會被拒絕。
- step、criteria、evidence、blocker、decision、scope drift 沒有收斂前，`task_complete` 不能完成任務。

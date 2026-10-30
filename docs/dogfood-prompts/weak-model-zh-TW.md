# 弱模型 Dogfood Prompt - 繁體中文

在發佈前，用真實 Pi session 搭配 `pi-tasks` 執行這些短 prompt，驗證中文任務、弱模型導引、current-step lock、evidence quality gate 與 completion gate。每段 prompt 要保持窄範圍，讓 release gate 測到 extension 行為，而不是測模型能不能一次記住很長的劇本。

## Source Extension Hardening

```text
原生語意模型 hardening dogfood。先呼叫 task_resume，確認沒有 active task 時建議 task_plan。接著呼叫 task_plan，建立一個語意上單一的步驟：「更新 package.json 的 version 欄位為 0.3.0」，expected output 是「package.json 只包含一個版本值 0.3.0」，evidenceRequired=true。不要提交 granularityCheck 或 decompositionStatus；省略 criterionIds，讓 pi-tasks 自動連結產生的 criterion。確認一般動作詞「更新」不會造成關鍵字式誤判，且步驟被判定為 atomic。接著對目前步驟呼叫 task_evidence：passed=true、type=command、level=e2e_smoke、summary 為「套件版本更新應該已完成」、references 與 artifactRefs 都是 ["package.json"]、source 為「預計的版本檢查」、reproducible=true、verifier=tool、command 為「node -p require('./package.json').version」、observedOutput 為「更新後版本應該是 0.3.0」。確認即使結構欄位完整，語意評估仍會拒絕這個未來預期。再以 summary 與 observedOutput 都是「package.json 回傳版本 0.3.0」重試並確認接受。最後呼叫 task_next，回報唯一建議動作。
```

## Installed Package Smoke

```text
已安裝套件原生語意 smoke。先呼叫 task_resume，接著呼叫 task_plan，步驟使用「更新 package.json 的 version 欄位為 0.3.0」。不要提交呼叫端 granularity 欄位。回報一般動作詞「更新」是否未遭 regex 式拒絕；如果 host 沒有原生模型邊界，也回報 structured recovery。
```

預期觀察：

- 一般動作詞「更新」不會觸發關鍵字式拒絕。
- 結構完整、但 observedOutput 只有未來預期的 passing evidence 會被語意評估拒絕。
- 含有具體觀測結果的 passing evidence 會被接受，且 `task_next` 只回傳一個建議動作。

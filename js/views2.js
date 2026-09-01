/* =========================================================
 * views2.js —— 其余视图：词汇 / 写作 / 翻译 / 语法 / 错题本 / 统计 / 我的 / 设置
 * ========================================================= */
(function () {
  "use strict";

  const esc = (s) => Cet4Utils.esc(s);
  const Data = Cet4Data;
  const Storage = Cet4Storage;

  /* ================= 词汇 ================= */
  async function vocab() {
    const words = (await Data.vocabulary()).words || [];
    const html =
      '<div class="page-title">词汇区</div>' +
      '<p class="page-sub">内置核心词 ' + words.length + " 个 + 词典自选 · 背词 / 自测 / 四六级词典</p>" +
      '<a class="card entry-card" href="#/vocab-test" style="display:block">' +
      '<div class="player-top"><span class="emoji" style="font-size:28px">🎯</span>' +
      '<div class="player-meta"><div class="name">词汇量检测</div>' +
      '<div class="time">快速估算你的词汇量，并给出备考建议</div></div>' +
      '<span class="arrow">›</span></div></a>' +
      '<div class="tab-bar">' +
      '<button type="button" class="tab active" data-tab="card">背词</button>' +
      '<button type="button" class="tab" data-tab="quiz">自测</button>' +
      '<button type="button" class="tab" data-tab="dict">词典</button>' +
      "</div>" +
      '<div id="vocab-panel"></div>';

    return {
      html,
      bind: (root) => bindVocab(root, words)
    };
  }

  function bindVocab(root, words) {
    if (!words.length) {
      root.querySelector("#vocab-panel").innerHTML = '<div class="empty">词表为空</div>';
      return;
    }
    const panel = root.querySelector("#vocab-panel");
    const tabs = root.querySelectorAll(".tab");
    let state = Cet4Vocab.getVocabState();
    let cardIdx = 0;
    let cardWords = words.slice();
    let writeState = { active: false };

    // 背词列表 = 内置核心词 + 从词典加入的自选词
    function getCardWords() {
      if (Storage.Settings.get().includeBuiltIn === false) {
        return Storage.StudyList.all();
      }
      return words.concat(Storage.StudyList.all());
    }

    function switchTab(name) {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      writeState.active = false;
      tabs.forEach((t) => t.classList.toggle("active", t.getAttribute("data-tab") === name));
      if (name === "card") {
        cardWords = getCardWords();
        if (cardIdx >= cardWords.length) cardIdx = Math.max(cardWords.length - 1, 0);
        renderCardFrame();
      } else if (name === "quiz") {
        renderQuiz();
      } else {
        renderDict();
      }
    }

    tabs.forEach((t) => {
      t.addEventListener("click", () => switchTab(t.getAttribute("data-tab")));
    });

    /* 背词页框架：顶部选择词库加入背词，下方是单词卡片 */
    function renderCardFrame() {
      panel.innerHTML =
        '<div class="card plan-panel">' +
        '<div class="plan-head"><span class="plan-title">今日计划背诵</span><span class="plan-state" id="plan-state"></span></div>' +
        '<div id="plan-body"></div>' +
        "</div>" +
        '<div class="card source-panel">' +
        '<div class="source-title">选择词典，一键加入背词</div>' +
        '<div class="source-btns">' +
        '<button type="button" class="btn btn-sm btn-outline" id="src-cet4">加入四级词</button>' +
        '<button type="button" class="btn btn-sm btn-outline" id="src-cet6">加入六级词</button>' +
        "</div>" +
        '<div style="margin-top:8px">' +
        '<button type="button" class="btn btn-sm btn-outline btn-block" id="src-builtin"></button>' +
        "</div>" +
        '<button type="button" class="btn btn-sm btn-outline btn-block" id="src-history" style="margin-top:8px">查看历史背诵</button>' +
        '<div class="source-info" id="vocab-source-info"></div>' +
        "</div>" +
        '<div id="vocab-card-wrap"></div>';

      const info = panel.querySelector("#vocab-source-info");
      function updateInfo() {
        const includeBuiltIn = Storage.Settings.get().includeBuiltIn !== false;
        const extra = Math.max(cardWords.length - (includeBuiltIn ? words.length : 0), 0);
        const parts = [];
        if (includeBuiltIn) parts.push("内置 " + words.length + " 词");
        if (extra > 0) parts.push("自选 " + extra + " 词");
        parts.push("共 " + cardWords.length + " 词");
        info.textContent = parts.join(" · ");
        const btn = panel.querySelector("#src-builtin");
        if (btn) btn.textContent = includeBuiltIn ? "去掉内置词" : "恢复内置词";
      }
      updateInfo();

      // 去掉/恢复内置核心词
      panel.querySelector("#src-builtin").addEventListener("click", () => {
        const next = Storage.Settings.get().includeBuiltIn === false;
        Storage.Settings.save({ includeBuiltIn: next });
        cardWords = getCardWords();
        if (cardIdx >= cardWords.length) cardIdx = Math.max(cardWords.length - 1, 0);
        updateInfo();
        renderCard();
        Cet4Utils.toast(next ? "已去掉内置词" : "已恢复内置词");
      });

      function loadLevel(level) {
        Data.dict()
          .then((d) => {
            const entries = (d.entries || []).filter((e) => e.levels.includes(level));
            const items = shuffle(entries.map(dictToStudyItem));
            if (!items.length) {
              Cet4Utils.toast("词典加载失败，请稍后重试");
              return;
            }
            const label = level === "cet4" ? "四级" : "六级";
            if (confirm("将 " + items.length + " 个" + label + "词随机顺序加入背词？")) {
              Storage.StudyList.addMany(items);
              // 整份自选词列表随机打乱，避免按字母顺序
              Storage.StudyList.save(shuffle(Storage.StudyList.all()));
              cardWords = getCardWords();
              updateInfo();
              renderCard();
              Cet4Utils.toast("已加入 " + items.length + " 个" + label + "词");
            }
          })
          .catch(() => Cet4Utils.toast("词典加载失败，请检查网络"));
      }

      panel.querySelector("#src-cet4").addEventListener("click", () => loadLevel("cet4"));
      panel.querySelector("#src-cet6").addEventListener("click", () => loadLevel("cet6"));
      panel.querySelector("#src-history").addEventListener("click", renderHistory);
      renderPlan();
      renderCard();
    }

    /* 历史背诵：已背 / 未背 单词列表 */
    function renderHistory() {
      const wrap = panel.querySelector("#vocab-card-wrap") || panel;
      if (!cardWords.length) {
        wrap.innerHTML = '<div class="empty">还没有可背的单词</div>';
        return;
      }
      const state = Cet4Vocab.getVocabState();
      let studiedCount = 0;
      cardWords.forEach((_, i) => {
        if (state.seen.includes(i)) studiedCount += 1;
      });
      const unstudiedCount = cardWords.length - studiedCount;

      wrap.innerHTML =
        '<div class="card">' +
        '<div class="history-head">' +
        '<div class="history-title">历史背诵</div>' +
        '<button type="button" class="btn btn-sm btn-outline" id="history-back">返回背词</button>' +
        "</div>" +
        '<div class="history-stats">已背 <b>' + studiedCount + "</b> 词 · 未背 <b>" + unstudiedCount + "</b> 词 · 共 " + cardWords.length + " 词</div>" +
        '<div class="dict-filters">' +
        '<button type="button" class="filter-chip active" data-hf="all">全部</button>' +
        '<button type="button" class="filter-chip" data-hf="done">已背</button>' +
        '<button type="button" class="filter-chip" data-hf="todo">未背</button>' +
        "</div>" +
        '<div id="history-list"></div>' +
        "</div>";

      let hf = "all";
      const list = wrap.querySelector("#history-list");

      function renderList() {
        const items = [];
        cardWords.forEach((w, i) => {
          const studiedFlag = state.seen.includes(i);
          const masteredFlag = state.mastered.includes(i);
          if (hf === "done" && !studiedFlag) return;
          if (hf === "todo" && studiedFlag) return;
          items.push({ w, studiedFlag, masteredFlag });
        });
        if (!items.length) {
          list.innerHTML = '<div class="empty">' + (hf === "todo" ? "没有未背的单词了 🎉" : "还没有已背的单词") + "</div>";
          return;
        }
        list.innerHTML = items.slice(0, 200).map(historyItemHTML).join("");
        list.querySelectorAll(".history-speak").forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            speakWord(btn.getAttribute("data-word"));
          });
        });
        if (items.length > 200) {
          list.insertAdjacentHTML("beforeend", '<div class="empty" style="padding:10px">仅显示前 200 条</div>');
        }
      }

      wrap.querySelectorAll(".filter-chip").forEach((c) => {
        c.addEventListener("click", () => {
          hf = c.getAttribute("data-hf");
          wrap.querySelectorAll(".filter-chip").forEach((x) => x.classList.toggle("active", x === c));
          renderList();
        });
      });
      wrap.querySelector("#history-back").addEventListener("click", renderCard);
      renderList();
    }

    function historyItemHTML(it) {
      const badge = it.masteredFlag
        ? '<span class="badge badge-success">已掌握</span>'
        : it.studiedFlag
          ? '<span class="badge">已背</span>'
          : '<span class="badge badge-muted">未背</span>';
      return (
        '<div class="history-item">' +
        '<span class="dict-word">' + esc(it.w.word) + "</span>" +
        (it.w.phonetic ? '<span class="dict-phonetic">' + esc(it.w.phonetic) + "</span>" : "") +
        '<button type="button" class="history-speak" data-word="' + esc(it.w.word) + '" aria-label="朗读">🔊</button>' +
        '<span class="history-meaning">' + esc(String(it.w.meaning || "").slice(0, 50)) + "</span>" +
        badge +
        "</div>"
      );
    }

    /* 今日计划面板 */
    function renderPlan() {
      const body = panel.querySelector("#plan-body");
      const stateEl = panel.querySelector("#plan-state");
      if (!body || !stateEl) return;
      const plan = Storage.DailyPlan.get();

      if (!plan) {
        stateEl.textContent = "未设置";
        body.innerHTML =
          '<div class="plan-form">' +
          '<input type="number" id="plan-input" min="1" max="500" placeholder="今天背几个词？" value="20">' +
          '<button type="button" class="btn btn-sm" id="plan-start">开始背诵</button>' +
          "</div>" +
          '<p style="font-size:11px;color:var(--muted);margin-top:6px">设置后今天最多背这些词，背满自动结束。</p>';
        body.querySelector("#plan-start").addEventListener("click", () => {
          const n = parseInt(body.querySelector("#plan-input").value, 10);
          if (!n || n < 1) {
            Cet4Utils.toast("请输入大于 0 的数字");
            return;
          }
          Storage.DailyPlan.set(n);
          renderPlan();
          renderCard();
          Cet4Utils.toast("今日计划 " + n + " 词，开始背吧");
        });
        return;
      }

      const left = Math.max(plan.total - plan.done, 0);
      const pct = Math.min(Math.round((plan.done / plan.total) * 100), 100);
      stateEl.textContent = plan.extended ? "继续中" : plan.done >= plan.total ? "已完成" : "进行中";
      const infoHtml = plan.extended
        ? '计划 <b>' + plan.total + "</b> 词 · 已背 <b>" + plan.done + "</b> · 超额继续中"
        : '计划 <b>' + plan.total + "</b> 词 · 已背 <b>" + plan.done + "</b> · 剩余 <b>" + left + "</b>";
      body.innerHTML =
        '<div class="plan-info">' + infoHtml + "</div>" +
        '<div class="progress-bar"><div style="width:' + pct + '%"></div></div>' +
        '<div class="plan-actions">' +
        '<button type="button" class="btn btn-sm btn-outline" id="plan-reset">重置计划</button>' +
        "</div>";
      body.querySelector("#plan-reset").addEventListener("click", () => {
        Storage.DailyPlan.clear();
        renderPlan();
        renderCard();
        Cet4Utils.toast("已重置今日计划");
      });
    }

    /* 今日计划完成的结束页 */
    function showPlanComplete() {
      const wrap = panel.querySelector("#vocab-card-wrap") || panel;
      const plan = Storage.DailyPlan.get();
      wrap.innerHTML =
        '<div class="card plan-done">' +
        '<div style="font-size:42px;text-align:center">🎉</div>' +
        '<div class="plan-done-title">今日计划已完成</div>' +
        '<div class="plan-done-sub">' + (plan ? plan.done + " / " + plan.total : "") + " 词，今天到此为止，也可以选择继续</div>" +
        '<div class="grid-2">' +
        '<button type="button" class="btn btn-secondary" id="plan-done-continue">继续背诵</button>' +
        '<button type="button" class="btn btn-outline" id="plan-reset-done">重置计划</button>' +
        "</div>" +
        "</div>";
      wrap.querySelector("#plan-done-continue").addEventListener("click", () => {
        Storage.DailyPlan.extend();
        renderPlan();
        renderCard();
      });
      wrap.querySelector("#plan-reset-done").addEventListener("click", () => {
        Storage.DailyPlan.clear();
        renderPlan();
        renderCard();
      });
    }

    function renderCard() {
      if (!cardWords.length) {
        const wrap = panel.querySelector("#vocab-card-wrap") || panel;
        wrap.innerHTML = '<div class="empty">还没有可背的单词，先从上方加入四级词或六级词</div>';
        return;
      }
      if (Storage.DailyPlan.isComplete()) {
        showPlanComplete();
        return;
      }
      state = Cet4Vocab.getVocabState();
      const wrap = panel.querySelector("#vocab-card-wrap") || panel;
      wrap.innerHTML = Cet4Vocab.cardHTML(cardWords, cardIdx, state);
      const noBtn = wrap.querySelector("#vocab-no");
      const yesBtn = wrap.querySelector("#vocab-yes");
      const prevBtn = wrap.querySelector("#vocab-prev");
      const nextBtn = wrap.querySelector("#vocab-next");
      const listenBtn = wrap.querySelector("#vocab-listen");
      const speakBtn = wrap.querySelector("#vocab-speak");
      const writeBtn = wrap.querySelector("#vocab-write");
      const wordEl = wrap.querySelector("#vocab-word");
      const w = cardWords[cardIdx];

      // 自选词显示小标签
      if (Storage.StudyList.has(w.word)) {
        const hdr = wrap.querySelector(".vocab-header");
        if (hdr) hdr.insertAdjacentHTML("beforeend", '<span class="badge badge-warn">自选词</span>');
      }

      if (listenBtn) {
        // 听：朗读单词
        listenBtn.addEventListener("click", () => speakWord(w.word));
      }
      if (speakBtn) {
        // 说：朗读例句
        speakBtn.addEventListener("click", () => speakWord(w.example || w.word));
      }
      if (writeBtn && wordEl) {
        writeBtn.addEventListener("click", () => {
          if (writeState.active && !writeState.done) {
            Cet4Utils.toast("先把单词拼对才能继续");
            return;
          }
          if (writeState.active && writeState.done) {
            exitWriteMode();
            return;
          }
          startWriteMode();
        });
      }
      // 进入新单词时自动朗读一遍
      speakWord(w.word);

      /* ---------- 写：逐字母拼写，正确发绿光，错误发红光，全对才能继续 ---------- */
      function startWriteMode() {
        const letters = w.word.split("");
        wordEl.classList.add("covered");

        // 生成字母格
        const grid = document.createElement("div");
        grid.className = "write-grid";
        grid.innerHTML = letters
          .map((ch, i) => '<span class="write-box" data-i="' + i + '">' + (ch === " " ? "&nbsp;" : "") + "</span>")
          .join("");
        wordEl.parentElement.insertAdjacentElement("afterend", grid);

        const hint = document.createElement("div");
        hint.className = "write-hint";
        hint.textContent = "敲出这个单词（退格可修改）";
        grid.insertAdjacentElement("afterend", hint);

        // 显示按钮：可看着单词输入，再点一下隐藏
        const showBtn = document.createElement("button");
        showBtn.type = "button";
        showBtn.className = "btn btn-sm btn-outline write-show";
        showBtn.textContent = "显示单词";
        showBtn.addEventListener("click", () => {
          const covered = wordEl.classList.toggle("covered");
          showBtn.textContent = covered ? "显示单词" : "隐藏单词";
        });
        hint.insertAdjacentElement("afterend", showBtn);

        // 隐藏输入框：接收键盘/手机键盘输入
        const input = document.createElement("input");
        input.type = "text";
        input.className = "write-input";
        input.maxLength = letters.length;
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("autocorrect", "off");
        input.spellcheck = false;
        hint.insertAdjacentElement("afterend", input);

        noBtn.disabled = true;
        yesBtn.disabled = true;
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        writeBtn.textContent = "写模式中…";

        writeState = {
          active: true,
          done: false,
          letters,
          boxes: Array.from(grid.querySelectorAll(".write-box")),
          typed: 0,
          input,
          hint
        };

        input.addEventListener("input", () => handleWriteInput(input));
        input.addEventListener("blur", () => {
          if (writeState.active && !writeState.done && document.body.contains(input)) {
            setTimeout(() => input.focus(), 0);
          }
        });
        input.focus();
      }

      function handleWriteInput(input) {
        const st = writeState;
        if (!st.active || st.done) return;
        const val = input.value;
        const len = st.letters.length;

        // 新增字母：逐个比对，正确变绿、错误变红
        while (st.typed < val.length && st.typed < len) {
          const ch = val[st.typed];
          const ok = ch.toLowerCase() === st.letters[st.typed].toLowerCase();
          const box = st.boxes[st.typed];
          box.textContent = ch;
          box.classList.toggle("ok", ok);
          box.classList.toggle("bad", !ok);
          st.typed += 1;
        }
        // 退格：清掉最后一格，允许修改
        while (st.typed > val.length) {
          st.typed -= 1;
          const box = st.boxes[st.typed];
          box.textContent = "";
          box.classList.remove("ok", "bad");
        }

        if (st.typed === len) {
          const allOk = st.boxes.every((b) => b.classList.contains("ok"));
          if (allOk) {
            st.done = true;
            wordEl.classList.remove("covered");
            const showBtn = wrap.querySelector(".write-show");
            if (showBtn) showBtn.textContent = "隐藏单词";
            noBtn.disabled = false;
            yesBtn.disabled = false;
            if (prevBtn) prevBtn.disabled = false;
            if (nextBtn) nextBtn.disabled = false;
            st.hint.textContent = "✓ 拼写正确，可以继续";
            st.hint.classList.add("ok");
            writeBtn.textContent = "写 ✓";
            input.blur();
            Cet4Utils.toast("拼写正确");
          } else {
            st.hint.textContent = "有拼写错误，按退格键修改";
            st.hint.classList.add("bad");
          }
        }
      }

      function exitWriteMode() {
        writeState.active = false;
        const grid = wrap.querySelector(".write-grid");
        const hint = wrap.querySelector(".write-hint");
        const input = wrap.querySelector(".write-input");
        const showBtn = wrap.querySelector(".write-show");
        if (grid) grid.remove();
        if (hint) hint.remove();
        if (input) input.remove();
        if (showBtn) showBtn.remove();
        wordEl.classList.remove("covered");
        writeBtn.textContent = "写";
      }

      function advance(mastered) {
        writeState.active = false;
        state = Cet4Vocab.getVocabState();
        if (!state.seen.includes(cardIdx)) state.seen.push(cardIdx);
        if (mastered === true) {
          if (!state.mastered.includes(cardIdx)) state.mastered.push(cardIdx);
        } else if (mastered === false) {
          state.mastered = state.mastered.filter((i) => i !== cardIdx);
        }
        // mastered === "next"：只记为已见，不改变掌握状态
        Cet4Vocab.saveVocabState(state);
        // 记录今天背过的单词（供“今日背诵”自测出题）
        {
          const prog = Storage.Progress.get();
          const today = Storage.todayStr();
          const tw = prog.vocab.todayWords && prog.vocab.todayWords.date === today
            ? prog.vocab.todayWords
            : { date: today, words: [] };
          if (!tw.words.includes(cardIdx)) tw.words.push(cardIdx);
          prog.vocab.todayWords = tw;
          Storage.Progress.save(prog);
        }
        // 今日计划：每背完一个词记一次，背满后不再展示下一个词
        if (Storage.DailyPlan.get()) {
          Storage.DailyPlan.addDone();
          if (Storage.DailyPlan.isComplete()) {
            Storage.Stats.recordToday();
            renderPlan();
            showContinueDialog(
              () => {
                Storage.DailyPlan.extend();
                renderPlan();
                renderCard();
              },
              () => {
                showPlanComplete();
              }
            );
            return;
          }
        }
        cardIdx = (cardIdx + 1) % cardWords.length;
        Storage.Stats.recordToday();
        renderCard();
      }

      noBtn.addEventListener("click", () => advance(false));
      yesBtn.addEventListener("click", () => advance(true));
      if (prevBtn) {
        // 上一次：回看上一条，不改变掌握状态
        prevBtn.addEventListener("click", () => {
          writeState.active = false;
          cardIdx = (cardIdx - 1 + cardWords.length) % cardWords.length;
          renderCard();
        });
      }
      if (nextBtn) nextBtn.addEventListener("click", () => advance("next"));
    }

    function renderQuiz() {
      const state = Cet4Vocab.getVocabState();
      const today = Storage.todayStr();
      const todayWords = state.todayWords && state.todayWords.date === today ? state.todayWords.words : [];
      const histIdx = [];
      const todayIdx = [];
      cardWords.forEach((_, i) => {
        if (state.seen.includes(i)) histIdx.push(i);
        if (todayWords.includes(i)) todayIdx.push(i);
      });

      panel.innerHTML =
        '<div class="card">' +
        '<div class="page-title">词汇自测</div>' +
        '<p class="page-sub">选择题目来源，输入想测的数量，开始检测记忆。</p>' +
        '<div class="quiz-source">' +
        '<label class="source-option"><input type="radio" name="quiz-src" value="history" checked>' +
        "<span><b>自测历史背诵</b><small>从背过的单词里出题（" + histIdx.length + " 词）</small></span></label>" +
        '<label class="source-option"><input type="radio" name="quiz-src" value="today">' +
        "<span><b>自测今日背诵</b><small>从今天背的单词里出题（" + todayIdx.length + " 词）</small></span></label>" +
        "</div>" +
        '<div class="plan-form" style="margin-top:12px">' +
        '<input type="number" id="quiz-count" min="1" max="50" value="10" placeholder="出几道题？">' +
        '<button type="button" class="btn btn-sm" id="quiz-start2">开始自测</button>' +
        "</div>" +
        "</div>";

      panel.querySelector("#quiz-start2").addEventListener("click", () => {
        const src = panel.querySelector('input[name="quiz-src"]:checked').value;
        const idxList = src === "today" ? todayIdx : histIdx;
        const pool = idxList.map((i) => cardWords[i]);
        if (!pool.length) {
          Cet4Utils.toast(src === "today" ? "今天还没背过单词，先去背词" : "还没有背过的单词，先去背词");
          return;
        }
        const n = parseInt(panel.querySelector("#quiz-count").value, 10);
        const count = Math.max(1, Math.min(n || 10, pool.length, 50));
        startQuiz(pool, count);
      });
    }

    function startQuiz(pool, count) {
      const questions = buildVocabQuiz(pool, count, cardWords);
      panel.innerHTML = Cet4Vocab.quizHTML(cardWords, questions);
      panel.querySelectorAll(".option").forEach((opt) => {
        opt.addEventListener("click", () => {
          const q = opt.getAttribute("data-q");
          panel.querySelectorAll('.option[data-q="' + q + '"]').forEach((o) => o.classList.remove("selected"));
          opt.classList.add("selected");
        });
      });
      panel.querySelector("#vocab-submit").addEventListener("click", () => {
        let correct = 0;
        questions.forEach((q, i) => {
          const sel = panel.querySelector('.option[data-q="vq' + i + '"].selected');
          if (sel && sel.getAttribute("data-val") === String(q.answer)) correct += 1;
        });
        const total = questions.length;
        Storage.Stats.addRecord(total, correct, 10);
        state = Cet4Vocab.getVocabState();
        state.quizBest = Math.max(state.quizBest || 0, correct);
        Cet4Vocab.saveVocabState(state);
        panel.innerHTML =
          '<div class="score-hero"><div class="big">' + correct + " / " + total + "</div>" +
          '<div class="sub">本轮正确 ' + correct + " 题 · 继续背词巩固</div></div>" +
          '<button type="button" class="btn btn-block" id="vocab-again">再来一轮</button>';
        panel.querySelector("#vocab-again").addEventListener("click", renderQuiz);
      });
    }

    /* ---------- 词典（懒加载） ---------- */
    let dictCache = null;

    function renderDict() {
      panel.innerHTML =
        '<div class="search-box"><input type="search" id="dict-search" placeholder="输入单词查询，例如 ability" autocomplete="off"></div>' +
        '<div class="dict-filters">' +
        '<button type="button" class="filter-chip active" data-level="all">全部</button>' +
        '<button type="button" class="filter-chip" data-level="cet4">四级</button>' +
        '<button type="button" class="filter-chip" data-level="cet6">六级</button>' +
        "</div>" +
        '<div id="dict-bulk"></div>' +
        '<div id="dict-list"><div class="empty">正在加载词典…</div></div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-sm btn-outline" id="dict-clear">清空自选词</button>' +
        '<span style="font-size:11px;color:var(--muted)">词库来源：ECDICT · 四六级大纲词表</span>' +
        "</div>";

      let level = "all";
      const search = panel.querySelector("#dict-search");
      const list = panel.querySelector("#dict-list");
      const chips = panel.querySelectorAll(".filter-chip");
      let timerId = null;

      function updateBulk() {
        const wrap = panel.querySelector("#dict-bulk");
        if (level === "all") {
          wrap.innerHTML = "";
          return;
        }
        const label = level === "cet4" ? "四级" : "六级";
        wrap.innerHTML =
          '<button type="button" class="btn btn-outline btn-block" id="dict-bulk-btn" style="margin-bottom:12px">' +
          "把全部" + label + "词加入背词</button>";
        wrap.querySelector("#dict-bulk-btn").addEventListener("click", () => {
          const items = dictCache.filter((e) => e.levels.includes(level)).map(dictToStudyItem);
          if (!items.length) return;
          if (confirm("确定把 " + items.length + " 个" + label + "词全部加入背词吗？加入后可在「背词」标签学习。")) {
            Storage.StudyList.addMany(items);
            Cet4Utils.toast("已加入 " + items.length + " 个词");
            render();
          }
        });
      }

      function render() {
        if (!dictCache) return;
        const q = search.value.trim().toLowerCase();
        const matched = dictCache.filter((e) => {
          if (level === "cet4" && !e.levels.includes("cet4")) return false;
          if (level === "cet6" && !e.levels.includes("cet6")) return false;
          const w = e.word.toLowerCase();
          return !q || w.indexOf(q) === 0 || w.includes(q);
        }).slice(0, 80);

        if (!matched.length) {
          list.innerHTML = '<div class="empty">没有找到相关单词，换个拼写试试</div>';
          return;
        }
        list.innerHTML = matched.map(dictItemHTML).join("");
        list.querySelectorAll(".dict-item").forEach((item) => {
          const ex = item.querySelector(".dict-example");
          const speak = item.querySelector(".dict-speak");
          if (ex) {
            item.querySelector(".dict-head").addEventListener("click", () => {
              ex.hidden = !ex.hidden;
            });
          }
          if (speak) {
            speak.addEventListener("click", (ev) => {
              ev.stopPropagation();
              speakWord(item.getAttribute("data-word"));
            });
          }
          const addBtn = item.querySelector(".dict-add");
          if (addBtn) {
            addBtn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              const word = addBtn.getAttribute("data-word");
              const entry = dictCache.find((x) => x.word === word);
              if (Storage.StudyList.has(word)) {
                Storage.StudyList.remove(word);
                addBtn.textContent = "+ 加入背词";
                addBtn.className = "btn btn-sm btn-outline dict-add";
                Cet4Utils.toast("已移出背词");
              } else if (entry) {
                Storage.StudyList.add(dictToStudyItem(entry));
                addBtn.textContent = "已加入 ✓";
                addBtn.className = "btn btn-sm btn-success dict-add";
                Cet4Utils.toast("已加入背词");
              }
            });
          }
        });
      }

      search.addEventListener("input", () => {
        clearTimeout(timerId);
        timerId = setTimeout(render, 180);
      });
      chips.forEach((c) => {
        c.addEventListener("click", () => {
          level = c.getAttribute("data-level");
          chips.forEach((x) => x.classList.toggle("active", x === c));
          updateBulk();
          render();
        });
      });

      panel.querySelector("#dict-clear").addEventListener("click", () => {
        if (confirm("确定清空所有自选词吗？此操作不可恢复。")) {
          Storage.StudyList.clear();
          Cet4Utils.toast("已清空自选词");
          render();
        }
      });

      if (!dictCache) {
        Data.dict()
          .then((d) => {
            dictCache = d.entries || [];
            updateBulk();
            render();
          })
          .catch(() => {
            list.innerHTML = '<div class="empty">词典加载失败，请检查网络后重试</div>';
          });
      } else {
        render();
      }
    }

    function dictItemHTML(e) {
      const badges = (e.levels || []).map((lv) =>
        lv === "cet4" ? '<span class="badge">四级</span>' : '<span class="badge badge-warn">六级</span>'
      ).join("");
      const added = Storage.StudyList.has(e.word);
      const example = e.example && e.example.length
        ? '<div class="dict-example" hidden>' +
          '<div class="en">' + esc(e.example[0]) + "</div>" +
          (e.example[1] ? '<div class="cn">' + esc(e.example[1]) + "</div>" : "") +
          "</div>"
        : "";
      return (
        '<div class="dict-item" data-word="' + esc(e.word) + '">' +
        '<div class="dict-head">' +
        '<span class="dict-word">' + esc(e.word) + "</span>" +
        (e.phonetic ? '<span class="dict-phonetic">' + esc(e.phonetic) + "</span>" : "") +
        badges +
        '<button type="button" class="dict-speak" aria-label="朗读">🔊</button>' +
        "</div>" +
        '<div class="dict-trans">' + esc(e.trans || "暂无释义") + "</div>" +
        '<div class="dict-foot">' +
        '<button type="button" class="btn btn-sm ' + (added ? "btn-success" : "btn-outline") + ' dict-add" data-word="' + esc(e.word) + '">' +
        (added ? "已加入 ✓" : "+ 加入背词") + "</button>" +
        "</div>" +
        example +
        "</div>"
      );
    }

    switchTab("card");
  }

  /* 把词典词条转成背词卡片需要的格式 */
  function dictToStudyItem(e) {
    return {
      word: e.word,
      phonetic: e.phonetic || "",
      meaning: e.trans || "",
      example: e.example && e.example[0] ? e.example[0] : "",
      exampleCn: e.example && e.example[1] ? e.example[1] : ""
    };
  }

  /* Fisher-Yates 随机打乱，返回新数组 */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /* 通用确认弹窗：今天到此为止 / 继续背诵 */
  function showContinueDialog(onContinue, onStop) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML =
      '<div class="modal-box">' +
      '<div class="modal-title">今日计划已完成 🎉</div>' +
      '<div class="modal-sub">已经背完今天的计划数量，要休息还是继续？</div>' +
      '<div class="modal-btns">' +
      '<button type="button" class="btn btn-secondary" id="modal-stop">今天到此为止</button>' +
      '<button type="button" class="btn" id="modal-continue">继续背诵</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    overlay.querySelector("#modal-stop").addEventListener("click", () => {
      overlay.remove();
      onStop();
    });
    overlay.querySelector("#modal-continue").addEventListener("click", () => {
      overlay.remove();
      onContinue();
    });
  }

  function buildVocabQuiz(pool, count, allWords) {
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count || 20, pool.length));
    const distractorPool = allWords && allWords.length ? allWords : pool;
    return selected.map((w) => {
      const distractors = distractorPool
        .filter((x) => x.word !== w.word)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((x) => x.meaning);
      const options = [w.meaning].concat(distractors).sort(() => Math.random() - 0.5);
      return { word: w.word, phonetic: w.phonetic, options, answer: options.indexOf(w.meaning) };
    });
  }

  /* 用浏览器语音朗读英文单词（Windows 自带 TTS） */
  function speakWord(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || ""));
      u.lang = "en-US";
      u.rate = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const enVoice = Cet4Listening.pickEnglishVoice(voices);
      if (enVoice) u.voice = enVoice;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn("语音朗读失败:", e);
    }
  }

  /* ================= 词汇量检测 ================= */
  async function vocabTest() {
    const data = await Data.vocabTest();
    const levels = data.levels || [];
    const all = [];
    levels.forEach((lv) => {
      (lv.words || []).forEach((w) => all.push(Object.assign({}, w, { level: lv.name })));
    });

    const html =
      '<div class="page-title">词汇量检测</div>' +
      '<p class="page-sub">共 ' + all.length + ' 词 · 只选你真正认识、能说出意思的词</p>' +
      '<div class="card" id="vt-card"></div>' +
      '<div class="progress-bar"><div id="vt-bar" style="width:0%"></div></div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:6px" id="vt-progress"></div>';

    return { html, bind: (root) => bindVocabTest(root, levels, all) };
  }

  function bindVocabTest(root, levels, all) {
    const card = root.querySelector("#vt-card");
    const bar = root.querySelector("#vt-bar");
    const progress = root.querySelector("#vt-progress");
    const answers = [];
    let idx = 0;

    function renderWord() {
      if (idx >= all.length) {
        renderResult();
        return;
      }
      const w = all[idx];
      bar.style.width = Math.round((idx / all.length) * 100) + "%";
      progress.textContent = (idx + 1) + " / " + all.length + " · " + w.level;
      card.innerHTML =
        '<div class="vt-word">' + esc(w.word) + "</div>" +
        '<div class="phonetic" style="font-size:14px;color:var(--muted);margin-bottom:14px">' + esc(w.phonetic) + "</div>" +
        '<div class="vt-options">' +
        '<button type="button" class="vt-btn know" data-choice="know">认识</button>' +
        '<button type="button" class="vt-btn unsure" data-choice="unsure">不确定</button>' +
        '<button type="button" class="vt-btn nope" data-choice="nope">不认识</button>' +
        "</div>";
      card.querySelectorAll(".vt-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          answers.push({ word: w.word, phonetic: w.phonetic, meaning: w.meaning, level: w.level, choice: btn.getAttribute("data-choice") });
          idx += 1;
          renderWord();
        });
      });
    }

    function renderResult() {
      const total = all.length;
      const known = answers.filter((a) => a.choice === "know").length;
      const unsure = answers.filter((a) => a.choice === "unsure").length;
      const estimate = Math.round(6000 * (known / total));
      const advice = vocabAdvice(estimate);

      const levelRows = levels.map((lv) => {
        const lvWords = answers.filter((a) => a.level === lv.name);
        const lvKnown = lvWords.filter((a) => a.choice === "know").length;
        const pct = lvWords.length ? Math.round((lvKnown / lvWords.length) * 100) : 0;
        return (
          '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12.5px">' +
          "<span>" + esc(lv.name) + "（" + esc(lv.range) + "）</span><span>" + lvKnown + "/" + lvWords.length + "</span></div>" +
          '<div class="progress-bar"><div style="width:' + pct + '%"></div></div></div>'
        );
      }).join("");

      const review = answers.map((a) =>
        '<div class="result-row' + (a.choice === "know" ? " correct" : "") + '">' +
        '<span class="no">' + esc(a.word) + "</span>" +
        "<span>" + esc(a.meaning) + "</span>" +
        '<span class="ans">' + (a.choice === "know" ? "认识" : a.choice === "unsure" ? "不确定" : "不认识") + "</span></div>"
      ).join("");

      card.innerHTML =
        '<div class="score-hero"><div class="big">约 ' + estimate + " 词</div>" +
        '<div class="sub">估算词汇量 · 认识 ' + known + " / " + total + " · 不确定 " + unsure + "</div></div>" +
        '<div class="card" style="margin-bottom:0"><div class="name" style="font-weight:700;font-size:16px">' + esc(advice.title) + "</div>" +
        '<div style="font-size:13.5px;margin-top:6px">' + esc(advice.text) + "</div></div>" +
        '<div class="section-title">各难度掌握情况</div>' +
        '<div class="card">' + levelRows + "</div>" +
        '<div class="section-title">单词回顾</div>' +
        '<div class="card">' + review + "</div>" +
        '<button type="button" class="btn btn-block" id="vt-again">重新检测</button>';
      bar.style.width = "100%";
      progress.textContent = "检测完成";
      card.querySelector("#vt-again").addEventListener("click", () => {
        answers.length = 0;
        idx = 0;
        renderWord();
      });
    }

    renderWord();
  }

  function vocabAdvice(estimate) {
    if (estimate < 1500) {
      return {
        title: "基础还需加强",
        text: "当前词汇量偏低。建议先集中背四级核心词，每天 20 个，配合例句记忆；先不要急着刷真题，先把词量补到 2500 左右。"
      };
    }
    if (estimate < 3000) {
      return {
        title: "接近四级入门水平",
        text: "已经有一定基础。建议每天背 25 个核心词，同时开始做阅读真题，在文章里巩固单词；听力每天听 20 分钟磨耳朵。"
      };
    }
    if (estimate < 4500) {
      return {
        title: "接近四级目标",
        text: "词汇量离四级目标不远了。建议把重心从“背单词”转向“用单词”：精读真题、整理错词、限时训练，重点补写作和翻译。"
      };
    }
    return {
      title: "词汇量已达标",
      text: "词汇量已达到甚至超过四级目标。接下来建议把时间更多投入听力、写作和真题限时模考，冲刺高分。"
    };
  }

  /* ================= 写作 ================= */
  async function writing() {
    const tpls = (await Data.writingTemplates()).templates || [];
    const html =
      '<div class="page-title">写作区</div>' +
      '<p class="page-sub">先背模板搭好框架，再去写原创题练手。</p>' +
      '<a class="card entry-card" href="#/quiz/original-writing" style="display:block">' +
      '<div class="player-top"><span class="emoji" style="font-size:28px">📝</span>' +
      '<div class="player-meta"><div class="name">原创写作练习</div>' +
      '<div class="time">3 个高频话题 + 参考范文</div></div>' +
      '<span class="arrow">›</span></div></a>' +
      '<div class="section-title">📐 写作模板</div>' +
      tpls.map((t) =>
        '<div class="card"><div class="name" style="font-weight:700;font-size:16px">' + esc(t.name) + "</div>" +
        '<div style="font-size:13px;color:var(--muted);margin:4px 0 10px">' + esc(t.use) + "</div>" +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px">结构</div>' +
        "<ol style=\"font-size:13px;margin:0 0 10px 20px\">" + (t.outline || []).map((o) => "<li>" + esc(o) + "</li>").join("") + "</ol>" +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px">常用句式</div>' +
        '<div style="font-size:13px;margin-bottom:10px">' + (t.sentences || []).map((s) => esc(s)).join(" · ") + "</div>" +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px">参考范文</div>' +
        '<div class="passage" style="font-size:13px;margin-bottom:0">' + esc(t.sample) + "</div></div>"
      ).join("");
    return { html };
  }

  /* ================= 翻译 ================= */
  async function translation() {
    const tips = [
      ["固定搭配", "遇到“随着……的发展”可用 with the development of；遇到“越来越……”可用 more and more。"],
      ["语序调整", "中文习惯把时间、地点放前面，英文常把主语和谓语提前，状语后置。"],
      ["避免逐字译", "先理解整句意思，再用英语的自然表达写出来，不要一个词一个词硬翻。"],
      ["时态一致", "看清句子描述的是过去、现在还是将来，全句保持时态一致。"]
    ];
    const html =
      '<div class="page-title">翻译区</div>' +
      '<p class="page-sub">四级翻译是“中译英段落”，先拆成句子逐句练习。</p>' +
      '<a class="card entry-card" href="#/quiz/original-translation" style="display:block">' +
      '<div class="player-top"><span class="emoji" style="font-size:28px">🌐</span>' +
      '<div class="player-meta"><div class="name">原创翻译练习</div>' +
      '<div class="time">5 个高频句子 + 参考译文</div></div>' +
      '<span class="arrow">›</span></div></a>' +
      '<div class="section-title">🧭 翻译要点</div>' +
      tips.map((t) =>
        '<div class="card"><div class="name" style="font-weight:700;font-size:15px">' + esc(t[0]) + "</div>" +
        '<div style="font-size:13.5px;margin-top:4px">' + esc(t[1]) + "</div></div>"
      ).join("");
    return { html };
  }

  /* ================= 语法 ================= */
  async function grammar() {
    const lessons = (await Data.grammar()).lessons || [];
    const html =
      '<div class="page-title">语法区</div>' +
      '<p class="page-sub">零基础也能看懂的 8 节讲义，每节配 5 道小测。</p>' +
      lessons.map((l, i) => {
        const prog = Storage.Progress.get().grammar[l.id];
        return (
          '<a class="list-item" href="#/grammar/' + l.id + '">' +
          '<span class="badge">' + (i + 1) + "</span>" +
          '<div class="main"><div class="title">' + esc(l.title) + "</div>" +
          '<div class="sub">' + esc(l.summary) + "</div></div>" +
          '<div style="text-align:right">' +
          (prog && prog.attempts ? '<span class="badge badge-success">做过</span>' : "") +
          '<span class="arrow">›</span></div></a>'
        );
      }).join("");
    return { html };
  }

  async function grammarLesson(id) {
    const lessons = (await Data.grammar()).lessons || [];
    const lesson = lessons.find((l) => l.id === id);
    if (!lesson) return { html: '<div class="empty">未找到该讲义</div>' };

    const html =
      '<a class="link-btn" href="#/grammar">‹ 返回语法区</a>' +
      '<div class="page-title" style="margin-top:8px">' + esc(lesson.title) + "</div>" +
      '<p class="page-sub">' + esc(lesson.summary) + "</p>" +
      '<div class="card lesson-content">' +
      (lesson.content || []).map((p) => "<p>" + esc(p) + "</p>").join("") +
      "</div>" +
      '<div class="section-title">随堂小测（' + (lesson.quiz || []).length + " 题）</div>" +
      '<div id="grammar-quiz">' +
      (lesson.quiz || []).map((q, i) =>
        '<div class="question-block"><div class="q-stem">' + (i + 1) + ". " + esc(q.stem) + "</div>" +
        (q.options || []).map((opt, oi) =>
          '<button type="button" class="option" data-q="gq' + i + '" data-val="' + oi + '">' +
          '<span class="opt-key">' + String.fromCharCode(65 + oi) + ")</span><span>" + esc(opt) + "</span></button>"
        ).join("") + "</div>"
      ).join("") +
      '<button type="button" class="btn btn-block btn-success" id="grammar-submit">提交判分</button>' +
      "</div>";

    return {
      html,
      bind: (root) => bindGrammarQuiz(root, lesson)
    };
  }

  function bindGrammarQuiz(root, lesson) {
    const quiz = lesson.quiz || [];
    root.querySelectorAll(".option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const q = opt.getAttribute("data-q");
        root.querySelectorAll('.option[data-q="' + q + '"]').forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
      });
    });

    root.querySelector("#grammar-submit").addEventListener("click", () => {
      let correct = 0;
      quiz.forEach((q, i) => {
        const sel = root.querySelector('.option[data-q="gq' + i + '"].selected');
        const letter = sel ? String.fromCharCode(65 + Number(sel.getAttribute("data-val"))) : "";
        if (letter === q.answer) correct += 1;
      });
      const total = quiz.length;
      Storage.Stats.addRecord(total, correct, 5);
      Storage.Progress.recordGrammar(lesson.id, { score: correct, total });

      const detail = quiz.map((q, i) => {
        const sel = root.querySelector('.option[data-q="gq' + i + '"].selected');
        const letter = sel ? String.fromCharCode(65 + Number(sel.getAttribute("data-val"))) : "未答";
        const ok = letter === q.answer;
        return (
          '<div class="result-row' + (ok ? " correct" : " wrong") + '"><span class="no">' + (i + 1) + "</span>" +
          "<span>" + esc(q.stem) + " · 你的 " + esc(letter) + " / 答案 " + esc(q.answer) + "</span>" +
          '<span class="ans">' + (ok ? "✓" : "✗") + "</span>" +
          '<div class="sub" style="font-size:12px;margin-top:2px">' + esc(q.analysis || "") + "</div></div>"
        );
      }).join("");

      const wrap = root.querySelector("#grammar-quiz");
      wrap.innerHTML =
        '<div class="score-hero"><div class="big">' + correct + " / " + total + "</div>" +
        '<div class="sub">随堂小测完成</div></div>' +
        '<div class="card">' + detail + "</div>" +
        '<a class="btn btn-block btn-secondary" href="#/grammar">返回语法区</a>';
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ================= 错题本 ================= */
  function mistakes() {
    const list = Storage.Mistakes.all();
    const html =
      '<div class="page-title">错题本</div>' +
      '<p class="page-sub">' + (list.length ? list.length + " 道错题待复习" : "还没有错题，继续保持") + "</p>" +
      (list.length ? '<button type="button" class="btn btn-outline btn-block" id="mistakes-clear" style="margin-bottom:12px">清空错题本</button>' : "") +
      list.map((m) =>
        '<div class="mistake-item">' +
        '<div class="q">' + esc(m.question) + "</div>" +
        '<div class="meta">来源：' + esc(m.source) + "</div>" +
        '<div class="meta">你的答案：<b>' + esc(m.yourAnswer || "未作答") + "</b> · 正确答案：<b>" + esc(m.correctAnswer) + "</b></div>" +
        (m.analysis ? '<div class="meta">解析：' + esc(m.analysis) + "</div>" : "") +
        '<div style="margin-top:8px"><button type="button" class="btn btn-sm btn-outline" data-del="' + esc(m.id) + '">移除</button></div>' +
        "</div>"
      ).join("");

    return {
      html,
      bind: (root) => {
        const clear = root.querySelector("#mistakes-clear");
        if (clear) {
          clear.addEventListener("click", () => {
            if (confirm("确定清空全部错题吗？此操作不可恢复。")) {
              Storage.Mistakes.clear();
              location.reload();
            }
          });
        }
        root.querySelectorAll("[data-del]").forEach((btn) => {
          btn.addEventListener("click", () => {
            Storage.Mistakes.remove(btn.getAttribute("data-del"));
            location.reload();
          });
        });
      }
    };
  }

  /* ================= 统计 ================= */
  function stats() {
    const s = Storage.Stats.get();
    const streak = Storage.calcStreak(s);
    const accuracy = s.totalQuestions ? Math.round((s.totalCorrect / s.totalQuestions) * 100) : 0;
    const days = [];
    for (let i = 27; i >= 0; i -= 1) {
      const date = Storage.todayStr(-i);
      const rec = s.days[date];
      days.push({ date, done: !!(rec && rec.done), today: i === 0, day: Number(date.slice(8)) });
    }
    const html =
      '<div class="page-title">学习统计</div>' +
      '<p class="page-sub">记录每天的学习，坚持比突击更重要。</p>' +
      '<div class="stat-strip">' +
      '<div class="stat-box"><div class="num">' + s.totalQuestions + "</div><div class=\"label\">累计做题</div></div>" +
      '<div class="stat-box"><div class="num">' + accuracy + "%</div><div class=\"label\">正确率</div></div>" +
      '<div class="stat-box"><div class="num">' + streak + "</div><div class=\"label\">连续打卡</div></div>" +
      "</div>" +
      '<div class="card"><div class="section-title">最近打卡</div>' +
      '<div class="days-grid">' +
      days.map((d) =>
        '<div class="day-cell' + (d.done ? " done" : "") + (d.today ? " today" : "") + '">' + d.day + "</div>"
      ).join("") +
      "</div>" +
      '<div style="font-size:12px;color:var(--muted);margin-top:6px">绿色 = 当天已学习 · 边框 = 今天</div></div>';
    return { html };
  }

  /* ================= 我的 ================= */
  function me() {
    const settings = Storage.Settings.get();
    const s = Storage.Stats.get();
    const mistakes = Storage.Mistakes.all();
    const streak = Storage.calcStreak(s);
    const html =
      '<div class="page-title">我的</div>' +
      '<div class="card" style="text-align:center">' +
      '<div style="font-size:40px">🎓</div>' +
      '<div style="font-weight:700;font-size:18px;margin-top:6px">' + esc(settings.userName || "备考同学") + "</div>" +
      '<div style="font-size:13px;color:var(--muted);margin-top:2px">目标考试 ' + Cet4Utils.fmtDate(settings.examDate) + " · 连续 " + streak + " 天</div>" +
      "</div>" +
      '<a class="list-item" href="#/stats"><span style="font-size:24px">📊</span><div class="main"><div class="title">学习统计</div><div class="sub">做题数与正确率</div></div><span class="arrow">›</span></a>' +
      '<a class="list-item" href="#/mistakes"><span style="font-size:24px">❌</span><div class="main"><div class="title">错题本</div><div class="sub">' + mistakes.length + " 道待复习</div></div><span class=\"arrow\">›</span></a>" +
      '<a class="list-item" href="#/settings"><span style="font-size:24px">⚙️</span><div class="main"><div class="title">设置</div><div class="sub">考试日期、昵称、主题</div></div><span class="arrow">›</span></a>';
    return { html };
  }

  /* ================= 设置 ================= */
  function settings() {
    const s = Storage.Settings.get();
    const html =
      '<div class="page-title">设置</div>' +
      '<div class="card">' +
      '<div class="form-field"><label for="set-name">昵称</label><input id="set-name" type="text" value="' + esc(s.userName) + '" placeholder="填写你的昵称"></div>' +
      '<div class="form-field"><label for="set-exam">目标考试日期</label><input id="set-exam" type="date" value="' + esc(s.examDate) + '"></div>' +
      '<div class="form-field"><label for="set-theme">主题</label><select id="set-theme">' +
      '<option value="light"' + (s.theme === "light" ? " selected" : "") + ">浅色</option>" +
      '<option value="dark"' + (s.theme === "dark" ? " selected" : "") + ">深色</option>" +
      "</select></div>" +
      '<button type="button" class="btn btn-block" id="set-save">保存设置</button>' +
      "</div>" +
      '<div class="card"><div class="section-title">数据管理</div>' +
      '<button type="button" class="btn btn-danger btn-block" id="set-clear">清空全部学习数据</button>' +
      '<p style="font-size:12px;color:var(--muted);margin-top:8px">会删除错题、统计、进度与设置，且无法恢复。</p></div>';

    return {
      html,
      bind: (root) => {
        root.querySelector("#set-save").addEventListener("click", () => {
          const next = Storage.Settings.save({
            userName: root.querySelector("#set-name").value.trim(),
            examDate: root.querySelector("#set-exam").value,
            theme: root.querySelector("#set-theme").value
          });
          document.body.setAttribute("data-theme", next.theme === "dark" ? "dark" : "light");
          Cet4Utils.toast("设置已保存");
        });
        root.querySelector("#set-clear").addEventListener("click", () => {
          if (confirm("确定清空全部学习数据吗？此操作不可恢复。")) {
            Storage.Mistakes.clear();
            Storage.Stats.clear();
            Storage.StudyList.clear();
            Storage.DailyPlan.clear();
            Storage.Progress.save({ quizzes: {}, papers: {}, vocab: { seen: [], mastered: [], quizAnswers: {} }, grammar: {} });
            location.reload();
          }
        });
      }
    };
  }

  window.Cet4Views = Object.assign({}, window.Cet4Views || {}, {
    vocab,
    vocabTest,
    writing,
    translation,
    grammar,
    grammarLesson,
    mistakes,
    stats,
    me,
    settings
  });
})();

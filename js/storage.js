/* =========================================================
 * storage.js —— 本地数据存储（localStorage 封装）
 * 所有用户进度、错题、统计、设置都存浏览器本地，无需登录。
 * ========================================================= */
(function () {
  "use strict";

  const KEYS = {
    settings: "cet4.settings",
    progress: "cet4.progress",
    mistakes: "cet4.mistakes",
    stats: "cet4.stats",
    studyList: "cet4.studyList",
    dailyPlan: "cet4.dailyPlan"
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("读取本地存储失败:", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("写入本地存储失败:", key, e);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("删除本地存储失败:", key, e);
    }
  }

  /* ---------- 设置 ---------- */
  const DEFAULT_SETTINGS = {
    examDate: "2026-12-19",   // 默认目标考试日期，可在设置中修改
    theme: "light",           // light | dark
    userName: "",
    remindDaily: true,
    includeBuiltIn: true       // 背词列表是否包含内置核心词
  };

  const Settings = {
    get() {
      return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {}));
    },
    save(patch) {
      const next = Object.assign({}, this.get(), patch);
      write(KEYS.settings, next);
      return next;
    }
  };

  /* ---------- 学习进度 ---------- */
  /*
   * progress 结构：
   * {
   *   quizzes: { [bankId]: { best: 分数, attempts: 次数, lastDate: "YYYY-MM-DD",
   *                          answers: { questionId: 用户答案 } } },
   *   papers:  { [paperId]: { answers: { 题号: 答案 }, score, total, date } },
   *   vocab:   { seen: [索引], mastered: [索引], quizBest: 分数, quizAnswers: {},
   *              todayWords: { date: "YYYY-MM-DD", words: [索引] } },
   *   grammar: { [lessonId]: { best, attempts } }
   * }
   */
  const DEFAULT_PROGRESS = {
    quizzes: {},
    papers: {},
    vocab: { seen: [], mastered: [], quizAnswers: {}, todayWords: { date: "", words: [] } },
    grammar: {}
  };

  const Progress = {
    get() {
      const p = read(KEYS.progress, DEFAULT_PROGRESS);
      return Object.assign({}, DEFAULT_PROGRESS, p, {
        vocab: Object.assign({}, DEFAULT_PROGRESS.vocab, p.vocab || {})
      });
    },
    save(next) {
      write(KEYS.progress, next);
      return next;
    },
    recordQuiz(bankId, result) {
      const p = this.get();
      const prev = p.quizzes[bankId] || { best: 0, attempts: 0, answers: {} };
      const next = {
        best: Math.max(prev.best, result.score),
        attempts: prev.attempts + 1,
        lastDate: todayStr(),
        answers: Object.assign({}, prev.answers, result.answers)
      };
      p.quizzes[bankId] = next;
      return this.save(p);
    },
    recordPaper(paperId, result) {
      const p = this.get();
      p.papers[paperId] = {
        answers: result.answers,
        score: result.score,
        total: result.total,
        date: todayStr()
      };
      return this.save(p);
    },
    recordGrammar(lessonId, result) {
      const p = this.get();
      const prev = p.grammar[lessonId] || { best: 0, attempts: 0 };
      p.grammar[lessonId] = {
        best: Math.max(prev.best, result.score),
        attempts: prev.attempts + 1
      };
      return this.save(p);
    }
  };

  /* ---------- 错题本 ---------- */
  /*
   * 每条错题：
   * { id, source: "听力原创/2025年12月真题…", question: 题干, yourAnswer, correctAnswer,
   *   analysis, date, reviewCount, kind: "choice"|"blank"|"sheet" }
   */
  const Mistakes = {
    all() {
      return read(KEYS.mistakes, []);
    },
    add(item) {
      const list = this.all();
      // 同一道题重复错：更新旧记录并累加复习次数
      const idx = list.findIndex((m) => m.id === item.id);
      if (idx >= 0) {
        list[idx] = Object.assign({}, list[idx], {
          yourAnswer: item.yourAnswer,
          correctAnswer: item.correctAnswer,
          date: todayStr(),
          reviewCount: (list[idx].reviewCount || 0) + 1
        });
      } else {
        list.unshift(Object.assign({ id: uid(), reviewCount: 0, date: todayStr() }, item));
      }
      write(KEYS.mistakes, list.slice(0, 300));
      return list;
    },
    addMany(items) {
      let list = this.all();
      const seen = new Set(list.map((m) => m.id));
      items.forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        list.unshift(Object.assign({ id: uid(), reviewCount: 0, date: todayStr() }, item));
      });
      write(KEYS.mistakes, list.slice(0, 300));
      return list;
    },
    remove(id) {
      const list = this.all().filter((m) => m.id !== id);
      write(KEYS.mistakes, list);
      return list;
    },
    clear() {
      write(KEYS.mistakes, []);
    }
  };

  /* ---------- 自选词（从词典加入背词列表） ---------- */
  /*
   * 每条自选词：
   * { word, phonetic, meaning, example, exampleCn }
   */
  const StudyList = {
    all() {
      return read(KEYS.studyList, []);
    },
    has(word) {
      return this.all().some((x) => x.word === word);
    },
    add(item) {
      const list = this.all();
      if (!list.some((x) => x.word === item.word)) {
        list.push(item);
      }
      write(KEYS.studyList, list);
      return list;
    },
    addMany(items) {
      const list = this.all();
      const seen = new Set(list.map((x) => x.word));
      items.forEach((it) => {
        if (it.word && !seen.has(it.word)) {
          seen.add(it.word);
          list.push(it);
        }
      });
      write(KEYS.studyList, list.slice(0, 6000));
      return list;
    },
    remove(word) {
      const list = this.all().filter((x) => x.word !== word);
      write(KEYS.studyList, list);
      return list;
    },
    save(list) {
      write(KEYS.studyList, (list || []).slice(0, 6000));
      return this.all();
    },
    clear() {
      write(KEYS.studyList, []);
    }
  };

  /* ---------- 今日计划背诵 ---------- */
  /*
   * dailyPlan 结构：{ date: "YYYY-MM-DD", total: 计划词数, done: 已背词数 }
   * 仅当 date 是今天时生效，跨天自动失效。
   */
  const DailyPlan = {
    get() {
      const p = read(KEYS.dailyPlan, null);
      if (!p || p.date !== todayStr()) return null;
      return p;
    },
    set(total) {
      const n = Math.max(1, Math.min(parseInt(total, 10) || 20, 500));
      const p = { date: todayStr(), total: n, done: 0 };
      write(KEYS.dailyPlan, p);
      return p;
    },
    addDone() {
      const p = this.get();
      if (!p) return null;
      if (p.done < p.total) p.done += 1;
      write(KEYS.dailyPlan, p);
      return p;
    },
    extend() {
      // 用户选择继续背诵：今天不再限量
      const p = this.get();
      if (!p) return null;
      p.extended = true;
      write(KEYS.dailyPlan, p);
      return p;
    },
    isComplete() {
      const p = this.get();
      return !!p && !p.extended && p.done >= p.total;
    },
    clear() {
      remove(KEYS.dailyPlan);
    }
  };

  /* ---------- 学习统计 ---------- */
  /*
   * stats 结构：
   * { days: { "YYYY-MM-DD": { questions, correct, minutes, done: true } },
   *   totalQuestions, totalCorrect }
   */
  const Stats = {
    get() {
      return read(KEYS.stats, { days: {}, totalQuestions: 0, totalCorrect: 0 });
    },
    addRecord(questions, correct, minutes) {
      const s = this.get();
      const day = todayStr();
      const d = s.days[day] || { questions: 0, correct: 0, minutes: 0, done: true };
      d.questions += questions;
      d.correct += correct;
      d.minutes += minutes || 0;
      d.done = true;
      s.days[day] = d;
      s.totalQuestions += questions;
      s.totalCorrect += correct;
      write(KEYS.stats, s);
      return s;
    },
    recordToday() {
      // 每日打卡：只记一次“今天学习过”，不增加题数
      const s = this.get();
      const day = todayStr();
      const d = s.days[day] || { questions: 0, correct: 0, minutes: 0 };
      d.done = true;
      s.days[day] = d;
      write(KEYS.stats, s);
      return s;
    },
    clear() {
      write(KEYS.stats, { days: {}, totalQuestions: 0, totalCorrect: 0 });
    }
  };

  /* ---------- 通用工具 ---------- */
  function todayStr(offsetDays) {
    const d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function uid() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* 连续打卡天数（到昨天为止的连续数 + 今天如果有也算） */
  function calcStreak(stats) {
    const days = stats.days || {};
    let streak = 0;
    let cursor = 0; // 0 = 今天，1 = 昨天…
    if (days[todayStr(0)]) cursor = 0;
    else cursor = 1; // 今天还没打卡，从昨天开始数
    while (days[todayStr(-cursor)]) {
      streak += 1;
      cursor += 1;
    }
    return streak;
  }

  window.Cet4Storage = {
    Settings,
    Progress,
    Mistakes,
    StudyList,
    DailyPlan,
    Stats,
    calcStreak,
    todayStr,
    uid,
    KEYS
  };
})();

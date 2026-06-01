const STORAGE_KEY = "marugotoMatching.v1";
const KAMIYAMA_DOMAIN = "@kamiyama.ac.jp";

const gradeOptions = ["1年生", "2年生", "3年生", "4年生", "5年生", "その他"];
const spOptions = [
  "ソニー",
  "ソフトバンク",
  "セコム",
  "デロイト",
  "富士通",
  "セプテーニ",
  "リコー",
  "CTC",
  "MIXI",
  "Sansan",
  "ロート",
  "その他",
];

const seedState = {
  session: null,
  profiles: [
    {
      id: "u1",
      email: "aoi@kamiyama.ac.jp",
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
      nickname: "あおい",
      grade: "2年生",
      hometown: "徳島県神山町",
      hobbies: ["#音楽", "#写真", "#散歩"],
      interests: ["#起業", "#教育", "#デザイン"],
      project: "町の空き家を使った学び場づくり #地域 #教育",
      sp: "Sansan",
      effort: "地域の人にインタビューして、学びの場の設計を進めています。",
      message: "放課後にゆっくり話せる人を探しています。",
      mbti: "ENFP",
      sns: "@aoi_marugoto",
    },
    {
      id: "u2",
      email: "ren@kamiyama.ac.jp",
      photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
      nickname: "れん",
      grade: "3年生",
      hometown: "大阪府",
      hobbies: ["#化学", "#登山", "#料理"],
      interests: ["#環境", "#有機化学", "#ものづくり"],
      project: "神山の水質を調べる化学実験プロジェクト #化学 #環境",
      sp: "ソニー",
      effort: "センサーで水質を可視化するプロトタイプを作っています。",
      message: "化学や自然観察が好きな人と話したいです。",
      mbti: "INTP",
      sns: "",
    },
    {
      id: "u3",
      email: "hina@kamiyama.ac.jp",
      photo: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=240&q=80",
      nickname: "ひな",
      grade: "1年生",
      hometown: "福岡県",
      hobbies: ["#イラスト", "#音楽", "#読書"],
      interests: ["#UI", "#ゲーム", "#心理学"],
      project: "校内イベントの案内アプリ #UI #イベント",
      sp: "MIXI",
      effort: "Figmaで使いやすい画面を研究中です。",
      message: "デザインレビューし合える友達がほしいです。",
      mbti: "ISFP",
      sns: "@hina_ui",
    },
    {
      id: "u4",
      email: "sota@kamiyama.ac.jp",
      photo: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80",
      nickname: "そうた",
      grade: "教職員",
      hometown: "東京都",
      hobbies: ["#珈琲", "#ランニング"],
      interests: ["#教育", "#AI", "#プロジェクト学習"],
      project: "学年間メンタリングの仕組みづくり #メンタリング #教育",
      sp: "その他",
      effort: "学生同士が自然に助け合える場を増やしています。",
      message: "相談したいことがあれば気軽にどうぞ。",
      mbti: "",
      sns: "",
    },
  ],
  wants: [
    { from: "u2", to: "u1", createdAt: "2026-05-29T12:30:00.000Z" },
    { from: "u1", to: "u3", createdAt: "2026-05-30T09:10:00.000Z" },
    { from: "u3", to: "u1", createdAt: "2026-05-31T16:20:00.000Z" },
  ],
  notifications: [
    {
      id: "n1",
      to: "u1",
      from: "u2",
      type: "want",
      text: "れんさんがあなたを話したい人に登録しました",
      createdAt: "2026-05-29T12:30:00.000Z",
      read: false,
    },
    {
      id: "n2",
      to: "u1",
      from: "u3",
      type: "match",
      text: "ひなさんとマッチしました",
      createdAt: "2026-05-31T16:20:00.000Z",
      read: false,
    },
  ],
  visits: [
    { viewer: "u1", viewed: "u2", createdAt: "2026-05-31T19:42:00.000Z" },
    { viewer: "u2", viewed: "u1", createdAt: "2026-05-31T12:00:00.000Z" },
    { viewer: "u3", viewed: "u1", createdAt: "2026-05-30T18:15:00.000Z" },
  ],
};

const app = document.getElementById("app");
let data = loadState();
let route = { name: "home" };
let query = "";
let toastTimer = 0;

render();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(seedState);
  try {
    return { ...structuredClone(seedState), ...JSON.parse(stored) };
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function currentUser() {
  return data.profiles.find((profile) => profile.id === data.session?.userId) || null;
}

function byId(id) {
  return data.profiles.find((profile) => profile.id === id);
}

function isMatch(a, b) {
  return hasWant(a, b) && hasWant(b, a);
}

function hasWant(from, to) {
  return data.wants.some((want) => want.from === from && want.to === to);
}

function render() {
  const user = currentUser();
  if (!user) {
    app.innerHTML = loginView();
    bindLogin();
    return;
  }

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <button class="brand" type="button" data-route="home" aria-label="ホームへ戻る">
          <span class="brand-mark">M</span>
          <span>
            <strong>まるごとマッチング</strong>
            <small>Kamiyama connection board</small>
          </span>
        </button>
        <div class="top-actions">
          <span class="domain-badge">${escapeHtml(data.session.email)}</span>
        </div>
      </header>
      <main>${routeView(user)}</main>
    </div>
    <div class="toast" id="toast" role="status"></div>
  `;
  bindCommon();
  bindRoute();
}

function loginView() {
  return `
    <main class="login-screen">
      <section class="login-visual" aria-label="神山の自然を感じる緑の背景">
        <div class="login-copy">
          <p>Kamiyama Marugoto College</p>
          <h1>まるごとマッチング</h1>
          <span>興味、プロジェクト、今頑張っていることから、話してみたい人を見つける。</span>
        </div>
      </section>
      <section class="login-panel">
        <div>
          <p class="label">Google Authentication</p>
          <h2>校内アカウントでログイン</h2>
        </div>
        <form id="loginForm" class="form-stack">
          <label class="field">
            <span>Googleアカウント</span>
            <input id="emailInput" type="email" value="aoi@kamiyama.ac.jp" autocomplete="email" required />
          </label>
          <p class="hint">@kamiyama.ac.jp のアカウントのみ利用できます。</p>
          <button class="primary-button" type="submit">ログイン</button>
          <p class="error-text" id="loginError"></p>
        </form>
      </section>
    </main>
  `;
}

function routeView(user) {
  if (route.name === "edit") return editView(user);
  if (route.name === "profile") return profileView(user, route.id);
  if (route.name === "list") return listView(user, route.kind);
  if (route.name === "search") return searchView(user);
  if (route.name === "tags") return tagsView();
  return homeView(user);
}

function homeView(user) {
  const notifications = data.notifications
    .filter((notification) => notification.to === user.id && !notification.read)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `
    <section class="home-grid">
      <div class="home-main">
        <button class="search-box search-entry" type="button" data-route="search">
          <span>検索</span>
          <strong>${query.trim() ? escapeHtml(query) : "学生、興味、プロジェクトを検索"}</strong>
        </button>
        ${
          notifications.length
            ? `<section class="notice-list">
                ${notifications.map((notice) => notificationItem(notice)).join("")}
                <button class="text-button" type="button" data-action="readNotifications">通知を既読にする</button>
              </section>`
            : ""
        }
      </div>
      <aside class="home-side">
        <button class="profile-card" type="button" data-route="edit">
          ${avatar(user)}
          <span>
            <strong>${escapeHtml(user.nickname)}</strong>
            <small>${escapeHtml(user.grade)}</small>
          </span>
        </button>
        <div class="feature-grid">
          ${featureButton("wantsMe", "あなたと話したい人", countWantsMe(user.id))}
          ${featureButton("myWants", "自分の話したい人リスト", countMyWants(user.id))}
          ${featureButton("history", "閲覧履歴", countHistory(user.id))}
          ${featureButton("footprints", "足あと", countFootprints(user.id))}
        </div>
        <button class="tag-index-button" type="button" data-route="tags">
          <span>ハッシュタグ一覧</span>
          <strong>${countAllHashtags()}件</strong>
        </button>
      </aside>
    </section>
  `;
}

function searchView(user) {
  return `
    <section class="search-page">
      <div class="search-header">
        <button class="icon-button" type="button" data-route="home" aria-label="戻る">戻る</button>
        <label class="search-field">
          <span>検索</span>
          <input id="searchInput" type="search" value="${escapeAttr(query)}" placeholder="化学、#音楽、2年生、プロジェクト..." autocomplete="off" autofocus />
        </label>
      </div>
      <section class="section-block search-results-block">
        <div class="section-head">
          <h2 id="searchResultTitle">${query.trim() ? "検索結果" : "キーワードを入力"}</h2>
          <span id="searchResultCount">${query.trim() ? `${searchProfiles(query, user.id).length}件` : ""}</span>
        </div>
        <div class="person-list" id="searchResults">${searchResultsMarkup(user)}</div>
      </section>
    </section>
  `;
}

function editView(user) {
  return `
    <section class="page-panel">
      <div class="page-head">
        <div>
          <p class="label">My Profile</p>
          <h1>プロフィール編集</h1>
        </div>
        <button class="icon-button" type="button" data-route="home">戻る</button>
      </div>
      <form id="profileForm" class="profile-form">
        ${imageUploadField(user)}
        ${textField("nickname", "ニックネーム", user.nickname, true)}
        <label class="field">
          <span>学年</span>
          <select name="gradeSelect" required>${gradeOptions.map((option) => optionHtml(option, gradeOptions.includes(user.grade) ? user.grade : "その他")).join("")}</select>
        </label>
        <label class="field conditional" data-grade-other>
          <span>その他の役職</span>
          <input name="gradeOther" maxlength="20" value="${gradeOptions.includes(user.grade) ? "" : escapeAttr(user.grade)}" />
        </label>
        ${textField("hometown", "出身地", user.hometown, true)}
        ${textField("hobbies", "趣味（例）#料理 #作曲 ...", user.hobbies.join(" "), true)}
        ${textField("interests", "興味分野（例）#起業 #IP産業 ...", user.interests.join(" "), true)}
        ${textField("project", "所属プロジェクト", user.project, true)}
        <label class="field">
          <span>所属SP</span>
          <select name="spSelect" required>${spOptions.map((option) => optionHtml(option, spOptions.includes(user.sp) ? user.sp : "その他")).join("")}</select>
        </label>
        <label class="field conditional" data-sp-other>
          <span>その他（スタッフの方）</span>
          <input name="spOther" maxlength="20" value="${spOptions.includes(user.sp) ? "" : escapeAttr(user.sp)}" />
        </label>
        ${textareaField("effort", "今頑張っていること", user.effort)}
        ${textareaField("message", "一言", user.message)}
        ${textField("mbti", "MBTI", user.mbti, false)}
        ${textField("sns", "SNS", user.sns, false)}
        <div class="form-actions">
          <button class="primary-button" id="saveProfileButton" type="submit">保存</button>
          <p class="hint">必須項目がそろうと保存できます。</p>
        </div>
      </form>
    </section>
  `;
}

function profileView(user, id) {
  const profile = byId(id);
  if (!profile) return notFoundView();
  const isSelf = profile.id === user.id;
  if (!isSelf) recordVisit(user.id, profile.id);
  const wanted = hasWant(user.id, profile.id);

  return `
    <section class="page-panel">
      <div class="page-head">
        <button class="icon-button" type="button" data-route="home">戻る</button>
        ${isSelf ? `<button class="primary-button compact" type="button" data-route="edit">編集</button>` : ""}
      </div>
      <article class="profile-detail ${isMatch(user.id, profile.id) ? "matched" : ""}">
        <div class="profile-hero">
          ${avatar(profile)}
          <div>
            <p class="label">${escapeHtml(profile.grade)} / ${escapeHtml(profile.sp)}</p>
            <h1>${escapeHtml(profile.nickname)}</h1>
            <p>${escapeHtml(profile.hometown)}</p>
          </div>
        </div>
        ${!isSelf ? `<button class="primary-button wide" type="button" data-action="toggleWant" data-id="${profile.id}">${wanted ? "話したい人から解除" : "話したい人に登録"}</button>` : ""}
        <div class="detail-grid">
          ${detailItem("趣味", tags(profile.hobbies))}
          ${detailItem("興味分野", tags(profile.interests))}
          ${detailItem("所属プロジェクト", escapeHtml(profile.project))}
          ${detailItem("所属SP", escapeHtml(profile.sp))}
          ${detailItem("今頑張っていること", escapeHtml(profile.effort || "未登録"))}
          ${detailItem("一言", escapeHtml(profile.message || "未登録"))}
          ${detailItem("MBTI", escapeHtml(profile.mbti || "未登録"))}
          ${detailItem("SNS", escapeHtml(profile.sns || "未登録"))}
        </div>
      </article>
    </section>
  `;
}

function listView(user, kind) {
  const config = {
    wantsMe: ["あなたと話したい人", data.wants.filter((want) => want.to === user.id).map((want) => want.from)],
    myWants: ["自分の話したい人リスト", data.wants.filter((want) => want.from === user.id).map((want) => want.to)],
    history: ["閲覧履歴", data.visits.filter((visit) => visit.viewer === user.id).sort(sortByDate).map((visit) => visit.viewed)],
    footprints: ["足あと", data.visits.filter((visit) => visit.viewed === user.id).sort(sortByDate).slice(0, 20).map((visit) => visit.viewer)],
  }[kind];
  if (!config) return notFoundView();

  const [title, ids] = config;
  const rows = ids.map((id) => byId(id)).filter(Boolean);

  return `
    <section class="page-panel">
      <div class="page-head">
        <div>
          <p class="label">List</p>
          <h1>${title}</h1>
        </div>
        <button class="icon-button" type="button" data-route="home">戻る</button>
      </div>
      <div class="person-list">${rows.map((profile) => personRow(profile, user.id, kind)).join("") || emptyState("まだ表示できるユーザーがいません")}</div>
    </section>
  `;
}

function tagsView() {
  const groups = collectHashtags();
  return `
    <section class="page-panel">
      <div class="page-head">
        <div>
          <p class="label">Hashtags</p>
          <h1>ハッシュタグ一覧</h1>
        </div>
        <button class="icon-button" type="button" data-route="home">戻る</button>
      </div>
      <div class="tag-index-grid">
        ${tagGroup("趣味", groups.hobbies)}
        ${tagGroup("興味分野", groups.interests)}
        ${projectGroup(groups.projects)}
      </div>
    </section>
  `;
}

function bindLogin() {
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    const error = document.getElementById("loginError");
    if (!email.endsWith(KAMIYAMA_DOMAIN)) {
      error.textContent = `${KAMIYAMA_DOMAIN} のGoogleアカウントのみログインできます。`;
      return;
    }
    let profile = data.profiles.find((item) => item.email === email);
    if (!profile) {
      profile = createProfile(email);
      data.profiles.push(profile);
    }
    data.session = { userId: profile.id, email };
    saveState();
    render();
  });
}

function bindCommon() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      route = { name: button.dataset.route };
      render();
    });
  });
}

function bindRoute() {
  bindProfileRows();
  document.querySelectorAll("[data-list]").forEach((button) => {
    button.addEventListener("click", () => {
      route = { name: "list", kind: button.dataset.list };
      render();
    });
  });
  document.getElementById("searchInput")?.addEventListener("input", (event) => {
    query = event.target.value;
    renderSearchResults();
  });
  bindSearchSuggestions();
  bindTagSearch();
  document.querySelector("[data-action='readNotifications']")?.addEventListener("click", () => {
    data.notifications = data.notifications.map((notice) =>
      notice.to === currentUser().id ? { ...notice, read: true } : notice
    );
    saveState();
    render();
  });
  document.querySelector("[data-action='toggleWant']")?.addEventListener("click", (event) => {
    toggleWant(currentUser().id, event.currentTarget.dataset.id);
  });
  bindProfileForm();
}

function bindProfileRows() {
  document.querySelectorAll("[data-profile]").forEach((row) => {
    row.addEventListener("click", () => {
      route = { name: "profile", id: row.dataset.profile };
      render();
    });
  });
}

function renderSearchResults() {
  const user = currentUser();
  const title = document.getElementById("searchResultTitle");
  const count = document.getElementById("searchResultCount");
  const results = document.getElementById("searchResults");
  if (!user || !title || !count || !results) return;

  const matchedProfiles = searchProfiles(query, user.id);
  title.textContent = query.trim() ? "検索結果" : "キーワードを入力";
  count.textContent = query.trim() ? `${matchedProfiles.length}件` : "";
  results.innerHTML = searchResultsMarkup(user);
  bindProfileRows();
  bindSearchSuggestions();
}

function bindSearchSuggestions() {
  document.querySelectorAll("[data-suggest]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("searchInput");
      query = button.dataset.suggest;
      if (input) input.value = query;
      renderSearchResults();
      input?.focus();
    });
  });
}

function bindTagSearch() {
  document.querySelectorAll("[data-tag-search]").forEach((button) => {
    button.addEventListener("click", () => {
      query = button.dataset.tagSearch;
      route = { name: "search" };
      render();
    });
  });
}

function bindProfileForm() {
  const form = document.getElementById("profileForm");
  if (!form) return;
  const gradeSelect = form.elements.gradeSelect;
  const spSelect = form.elements.spSelect;
  const syncConditional = () => {
    form.querySelector("[data-grade-other]").classList.toggle("visible", gradeSelect.value === "その他");
    form.querySelector("[data-sp-other]").classList.toggle("visible", spSelect.value === "その他");
  };
  gradeSelect.addEventListener("change", syncConditional);
  spSelect.addEventListener("change", syncConditional);
  syncConditional();

  const avatarInput = form.elements.avatarFile;
  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    const preview = document.getElementById("avatarPreview");
    preview.src = URL.createObjectURL(file);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const user = currentUser();
    const grade = formData.get("gradeSelect") === "その他" ? formData.get("gradeOther").trim() : formData.get("gradeSelect");
    const sp = formData.get("spSelect") === "その他" ? formData.get("spOther").trim() : formData.get("spSelect");
    const avatarFile = formData.get("avatarFile");
    let photo = formData.get("photo").trim();
    if (avatarFile?.size) {
      try {
        photo = await readFileAsDataUrl(avatarFile);
      } catch {
        showToast("画像を読み込めませんでした");
        return;
      }
    }
    const next = {
      ...user,
      photo,
      nickname: formData.get("nickname").trim(),
      grade,
      hometown: formData.get("hometown").trim(),
      hobbies: normalizeTags(formData.get("hobbies")),
      interests: normalizeTags(formData.get("interests")),
      project: formData.get("project").trim(),
      sp,
      effort: formData.get("effort").trim(),
      message: formData.get("message").trim(),
      mbti: formData.get("mbti").trim(),
      sns: formData.get("sns").trim(),
    };
    if (!isProfileComplete(next)) {
      showToast("必須項目を入力してください");
      return;
    }
    data.profiles = data.profiles.map((profile) => (profile.id === user.id ? next : profile));
    saveState();
    showToast("プロフィールを保存しました");
    route = { name: "home" };
    render();
  });
}

function toggleWant(from, to) {
  const target = byId(to);
  if (!target) return;
  if (hasWant(from, to)) {
    data.wants = data.wants.filter((want) => !(want.from === from && want.to === to));
    showToast("話したい人から解除しました");
  } else {
    data.wants.push({ from, to, createdAt: new Date().toISOString() });
    const fromProfile = byId(from);
    data.notifications.push({
      id: crypto.randomUUID(),
      to,
      from,
      type: "want",
      text: `${fromProfile.nickname}さんがあなたを話したい人に登録しました`,
      createdAt: new Date().toISOString(),
      read: false,
    });
    if (hasWant(to, from)) {
      data.notifications.push({
        id: crypto.randomUUID(),
        to: from,
        from: to,
        type: "match",
        text: `${target.nickname}さんとマッチしました`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    showToast(isMatch(from, to) ? "マッチしました" : "話したい人に登録しました");
  }
  saveState();
  render();
}

function recordVisit(viewer, viewed) {
  const now = Date.now();
  const latest = data.visits.find((visit) => visit.viewer === viewer && visit.viewed === viewed);
  if (latest && now - new Date(latest.createdAt).getTime() < 60 * 1000) return;
  data.visits = [{ viewer, viewed, createdAt: new Date().toISOString() }, ...data.visits]
    .filter((visit, index, visits) => visits.findIndex((item) => item.viewer === visit.viewer && item.viewed === visit.viewed) === index)
    .slice(0, 100);
  saveState();
}

function searchProfiles(term, currentId) {
  const normalized = term.trim().toLowerCase().replace(/^#/, "");
  if (!normalized) return [];
  return data.profiles
    .filter((profile) => profile.id !== currentId)
    .map((profile) => ({ profile, score: searchScore(profile, normalized) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.nickname.localeCompare(b.profile.nickname, "ja"))
    .map((item) => item.profile);
}

function searchResultsMarkup(user) {
  if (!query.trim()) {
    return `
      <div class="search-suggestions">
        ${["#化学", "#音楽", "#起業", "2年生", "教育", "プロジェクト"].map((term) => `<button type="button" data-suggest="${escapeAttr(term)}">${escapeHtml(term)}</button>`).join("")}
      </div>
      ${emptyState("検索したい言葉を入力してください")}
    `;
  }
  const results = searchProfiles(query, user.id);
  return results.map((profile) => personRow(profile, user.id)).join("") || emptyState("一致するユーザーがいません");
}

function searchScore(profile, term) {
  const exactFields = [...profile.hobbies, ...profile.interests, ...extractHashtags(profile.project)].map((tag) => tag.replace(/^#/, "").toLowerCase());
  if (exactFields.includes(term)) return 100;
  const fields = [
    profile.nickname,
    profile.grade,
    profile.hometown,
    profile.project,
    profile.sp,
    profile.effort,
    profile.message,
    profile.mbti,
    ...profile.hobbies,
    ...profile.interests,
    ...extractHashtags(profile.project),
  ].map((value) => String(value || "").toLowerCase().replace(/^#/, ""));
  if (fields.includes(term)) return 80;
  return fields.some((value) => value.includes(term)) ? 40 : 0;
}

function createProfile(email) {
  const nickname = email.split("@")[0];
  return {
    id: crypto.randomUUID(),
    email,
    photo: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=240&q=80",
    nickname,
    grade: "その他",
    hometown: "",
    hobbies: [],
    interests: [],
    project: "",
    sp: "その他",
    effort: "",
    message: "",
    mbti: "",
    sns: "",
  };
}

function isProfileComplete(profile) {
  return Boolean(
    profile.photo &&
      profile.nickname &&
      profile.grade &&
      profile.hometown &&
      profile.hobbies.length &&
      profile.interests.length &&
      profile.project &&
      profile.sp
  );
}

function normalizeTags(value) {
  return String(value)
    .split(/[\s,、]+/)
    .map((tag) => tag.trim().replace(/^#?/, "#"))
    .filter((tag) => tag.length > 1);
}

function extractHashtags(value) {
  return Array.from(String(value || "").matchAll(/#[^\s#、,，。]+/g), (match) => match[0]);
}

function collectHashtags() {
  return data.profiles.reduce(
    (groups, profile) => {
      addTags(groups.hobbies, profile.hobbies);
      addTags(groups.interests, profile.interests);
      addProject(groups.projects, profile.project);
      return groups;
    },
    { hobbies: new Map(), interests: new Map(), projects: new Map() }
  );
}

function addTags(map, tagsToAdd) {
  tagsToAdd.forEach((tag) => {
    map.set(tag, (map.get(tag) || 0) + 1);
  });
}

function addProject(map, project) {
  const normalized = String(project || "").trim();
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function countAllHashtags() {
  const groups = collectHashtags();
  return new Set([...groups.hobbies.keys(), ...groups.interests.keys()]).size + groups.projects.size;
}

function tagGroup(title, tagsMap) {
  const items = Array.from(tagsMap.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));
  return `
    <section class="tag-index-section">
      <div class="section-head">
        <h2>${title}</h2>
        <span>${items.length}件</span>
      </div>
      <div class="tag-index-list">
        ${
          items.length
            ? items.map(([tag, count]) => `<button type="button" data-tag-search="${escapeAttr(tag)}"><span>${escapeHtml(tag)}</span><small>${count}</small></button>`).join("")
            : emptyState("登録されたハッシュタグがありません")
        }
      </div>
    </section>
  `;
}

function projectGroup(projectsMap) {
  const items = Array.from(projectsMap.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));
  return `
    <section class="tag-index-section project-index-section">
      <div class="section-head">
        <h2>所属プロジェクト</h2>
        <span>${items.length}件</span>
      </div>
      <div class="project-index-list">
        ${
          items.length
            ? items.map(([project, count]) => `<button type="button" data-tag-search="${escapeAttr(project)}"><span>${escapeHtml(project)}</span><small>${count}</small></button>`).join("")
            : emptyState("登録されたプロジェクトがありません")
        }
      </div>
    </section>
  `;
}

function featureButton(kind, title, count) {
  return `
    <button class="feature-button" type="button" data-list="${kind}">
      <span>${title}</span>
      <strong>${count}</strong>
    </button>
  `;
}

function personRow(profile, userId, kind = "") {
  const matched = isMatch(userId, profile.id);
  const visit = kind === "history"
    ? data.visits.find((item) => item.viewer === userId && item.viewed === profile.id)
    : kind === "footprints"
      ? data.visits.find((item) => item.viewer === profile.id && item.viewed === userId)
      : null;
  return `
    <button class="person-row ${matched ? "matched" : ""}" type="button" data-profile="${profile.id}">
      ${avatar(profile)}
      <span>
        <strong>${escapeHtml(profile.nickname)}</strong>
        <small>${escapeHtml(profile.grade)}${visit ? ` / ${formatDate(visit.createdAt)}` : ""}</small>
      </span>
      ${matched ? `<em>マッチ</em>` : ""}
    </button>
  `;
}

function notificationItem(notice) {
  return `
    <button class="notice-item" type="button" data-profile="${notice.from}">
      <span>${notice.type === "match" ? "MATCH" : "WANT"}</span>
      <strong>${escapeHtml(notice.text)}</strong>
      <small>${formatDate(notice.createdAt)}</small>
    </button>
  `;
}

function avatar(profile) {
  return `<img class="avatar" src="${escapeAttr(profile.photo)}" alt="${escapeAttr(profile.nickname)}のアイコン写真" />`;
}

function tags(items) {
  return `<div class="tag-list">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
}

function detailItem(label, value) {
  return `<section class="detail-item"><h2>${label}</h2><div>${value}</div></section>`;
}

function textField(name, label, value, required) {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" value="${escapeAttr(value)}" ${required ? "required" : ""} />
    </label>
  `;
}

function textareaField(name, label, value) {
  return `
    <label class="field span-2">
      <span>${label}</span>
      <textarea name="${name}" rows="4">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function imageUploadField(user) {
  return `
    <label class="field image-upload-field span-2">
      <span>アイコン写真</span>
      <div class="image-upload">
        <img id="avatarPreview" class="avatar upload-preview" src="${escapeAttr(user.photo)}" alt="現在のアイコン写真" />
        <div>
          <strong>写真を選択</strong>
          <small>Finderやスマホの写真フォルダから画像を選べます。</small>
        </div>
      </div>
      <input name="avatarFile" type="file" accept="image/*" />
      <input name="photo" type="hidden" value="${escapeAttr(user.photo)}" />
    </label>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function optionHtml(option, selected) {
  return `<option value="${escapeAttr(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`;
}

function emptyState(text) {
  return `<p class="empty-state">${text}</p>`;
}

function notFoundView() {
  return `<section class="page-panel">${emptyState("ページが見つかりません")}</section>`;
}

function countWantsMe(id) {
  return data.wants.filter((want) => want.to === id).length;
}

function countMyWants(id) {
  return data.wants.filter((want) => want.from === id).length;
}

function countHistory(id) {
  return data.visits.filter((visit) => visit.viewer === id).length;
}

function countFootprints(id) {
  return Math.min(20, data.visits.filter((visit) => visit.viewed === id).length);
}

function sortByDate(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

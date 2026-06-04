const KAMIYAMA_DOMAIN = "@kamiyama.ac.jp";
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=240&q=80";

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

const app = document.getElementById("app");
const toastRoot = document.createElement("div");
toastRoot.className = "toast";
toastRoot.id = "toast";
toastRoot.setAttribute("role", "status");
document.body.appendChild(toastRoot);

const supabaseConfig = window.MARUGOTO_SUPABASE_CONFIG || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
const supabaseClient = hasSupabaseConfig && window.supabase
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

const state = {
  session: null,
  profiles: [],
  wants: [],
  notifications: [],
  visits: [],
  route: { name: "home" },
  authScreen: "login",
  query: "",
  loading: true,
  authMessage: "",
  authError: "",
  saving: false,
};

let toastTimer = 0;

render();
init().catch((error) => {
  console.error(error);
  state.loading = false;
  state.authError = "初期化に失敗しました。設定を確認してください。";
  render();
});

async function init() {
  if (!hasSupabaseConfig || !supabaseClient) {
    state.loading = false;
    render();
    return;
  }

  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();

  if (error) throw error;

  state.session = session;

  if (session?.user) {
    await bootstrapSignedInUser(session.user);
  }

  state.loading = false;
  render();

  supabaseClient.auth.onAuthStateChange(async (_event, sessionNext) => {
    state.session = sessionNext;
    state.authError = "";

    if (!sessionNext?.user) {
      clearAppData();
      state.route = { name: "home" };
      render();
      return;
    }

    try {
      await bootstrapSignedInUser(sessionNext.user);
    } catch (error) {
      console.error(error);
      state.authError = "ログイン後の読み込みに失敗しました。";
    }

    render();
  });
}

async function bootstrapSignedInUser(authUser) {
  if (!String(authUser.email || "").toLowerCase().endsWith(KAMIYAMA_DOMAIN)) {
    await supabaseClient.auth.signOut();
    state.authError = `${KAMIYAMA_DOMAIN} を含むメールアドレスのみログインできます。`;
    clearAppData();
    return;
  }

  await ensureProfile(authUser);
  await loadAppData();
}

async function ensureProfile(authUser) {
  const baseProfile = {
    id: authUser.id,
    email: authUser.email,
    nickname: (authUser.email || "user").split("@")[0],
    photo_url: DEFAULT_AVATAR,
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

  const { error } = await supabaseClient.from("profiles").upsert(baseProfile, { onConflict: "id" });
  if (error) throw error;
}

async function loadAppData() {
  const currentUserId = state.session?.user?.id;
  if (!currentUserId) return;

  const [profilesResult, wantsResult, notificationsResult, visitsResult] = await Promise.all([
    supabaseClient.from("profiles").select("*").order("updated_at", { ascending: false }),
    supabaseClient.from("want_links").select("*").order("created_at", { ascending: false }),
    supabaseClient
      .from("notifications")
      .select("*")
      .eq("to_user", currentUserId)
      .order("created_at", { ascending: false }),
    supabaseClient
      .from("profile_visits")
      .select("*")
      .or(`viewer_id.eq.${currentUserId},viewed_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false }),
  ]);

  const errors = [
    profilesResult.error,
    wantsResult.error,
    notificationsResult.error,
    visitsResult.error,
  ].filter(Boolean);

  if (errors.length) throw errors[0];

  state.profiles = (profilesResult.data || []).map(mapProfileRow);
  state.wants = (wantsResult.data || []).map((row) => ({
    from: row.from_user,
    to: row.to_user,
    createdAt: row.created_at,
  }));
  state.notifications = (notificationsResult.data || []).map((row) => ({
    id: row.id,
    to: row.to_user,
    from: row.from_user,
    type: row.type,
    text: row.text,
    createdAt: row.created_at,
    read: row.read,
  }));
  state.visits = (visitsResult.data || []).map((row) => ({
    id: row.id,
    viewer: row.viewer_id,
    viewed: row.viewed_id,
    createdAt: row.created_at,
  }));
}

function clearAppData() {
  state.profiles = [];
  state.wants = [];
  state.notifications = [];
  state.visits = [];
}

function mapProfileRow(row) {
  return {
    id: row.id,
    email: row.email || "",
    photo: row.photo_url || DEFAULT_AVATAR,
    nickname: row.nickname || "",
    grade: row.grade || "その他",
    hometown: row.hometown || "",
    hobbies: Array.isArray(row.hobbies) ? row.hobbies : [],
    interests: Array.isArray(row.interests) ? row.interests : [],
    project: row.project || "",
    sp: row.sp || "その他",
    effort: row.effort || "",
    message: row.message || "",
    mbti: row.mbti || "",
    sns: row.sns || "",
  };
}

function currentUser() {
  return state.profiles.find((profile) => profile.id === state.session?.user?.id) || null;
}

function byId(id) {
  return state.profiles.find((profile) => profile.id === id);
}

function isMatch(a, b) {
  return hasWant(a, b) && hasWant(b, a);
}

function hasWant(from, to) {
  return state.wants.some((want) => want.from === from && want.to === to);
}

function render() {
  if (state.loading) {
    app.innerHTML = loadingView();
    return;
  }

  if (!hasSupabaseConfig || !supabaseClient) {
    app.innerHTML = setupView();
    return;
  }

  const user = currentUser();
  if (!user) {
    app.innerHTML = authView();
    bindAuth();
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
          <span class="domain-badge">${escapeHtml(state.session.user.email || "")}</span>
        </div>
      </header>
      <main>${routeView(user)}</main>
    </div>
  `;
  bindCommon();
  bindRoute();
}

function loadingView() {
  return `
    <main class="login-screen">
      <section class="login-visual" aria-label="神山の自然を感じる緑の背景">
        <div class="login-copy">
          <p>Kamiyama Marugoto College</p>
          <h1>まるごとマッチング</h1>
          <span>読み込み中です。少しだけ待ってください。</span>
        </div>
      </section>
      <section class="login-panel">
        <div class="setup-card">
          <p class="label">Loading</p>
          <h2>アプリを準備しています</h2>
        </div>
      </section>
    </main>
  `;
}

function setupView() {
  return `
    <main class="login-screen">
      <section class="login-visual" aria-label="神山の自然を感じる緑の背景">
        <div class="login-copy">
          <p>Kamiyama Marugoto College</p>
          <h1>まるごとマッチング</h1>
          <span>Supabase の接続情報を入れると、全ユーザーで同じデータを共有できます。</span>
        </div>
      </section>
      <section class="login-panel">
        <div class="setup-card">
          <p class="label">Supabase Setup</p>
          <h2>設定が未完了です</h2>
          <p class="hint"><code>supabase-config.js</code> に URL と anon key を入れてください。</p>
          <p class="hint">SQL は <code>supabase-schema.sql</code> に出力しています。</p>
        </div>
      </section>
    </main>
  `;
}

function authView() {
  const isLogin = state.authScreen === "login";
  return `
    <main class="login-screen">
      <section class="login-visual" aria-label="落ち着いた緑の背景">
        <div class="login-copy">
          <p>Kamiyama Marugoto College</p>
          <h1>まるごとマッチング</h1>
          <span>${isLogin ? "校内アカウントのメールアドレスとパスワードでログインできます。" : "最初にアカウントを作成すると、そのままプロフィール登録へ進めます。"}</span>
        </div>
      </section>
      <section class="login-panel">
        <div class="auth-switch" role="tablist" aria-label="認証画面切り替え">
          <button class="${isLogin ? "active" : ""}" type="button" data-auth-screen="login">ログイン</button>
          <button class="${!isLogin ? "active" : ""}" type="button" data-auth-screen="signup">新規登録</button>
        </div>
        <div>
          <h2>${isLogin ? "校内アカウントでログイン" : "校内アカウントを新規登録"}</h2>
        </div>
        <form id="authForm" class="form-stack">
          <label class="field">
            <span>メールアドレス</span>
            <input id="emailInput" type="email" placeholder="name@kamiyama.ac.jp" autocomplete="email" required />
          </label>
          <label class="field">
            <span>パスワード</span>
            <input id="passwordInput" type="password" placeholder="パスワードを入力" autocomplete="${isLogin ? "current-password" : "new-password"}" required />
          </label>
          ${
            isLogin
              ? ""
              : `<label class="field">
                  <span>パスワード確認</span>
                  <input id="passwordConfirmInput" type="password" placeholder="もう一度入力" autocomplete="new-password" required />
                </label>`
          }
          <p class="hint">${KAMIYAMA_DOMAIN} を含むメールアドレスだけログインできます。</p>
          <button class="primary-button" type="submit">${isLogin ? "ログイン" : "新規登録"}</button>
          <p class="hint">${escapeHtml(state.authMessage)}</p>
          <p class="error-text" id="loginError">${escapeHtml(state.authError)}</p>
        </form>
      </section>
    </main>
  `;
}

function routeView(user) {
  if (state.route.name === "edit") return editView(user);
  if (state.route.name === "profile") return profileView(user, state.route.id);
  if (state.route.name === "list") return listView(user, state.route.kind);
  if (state.route.name === "search") return searchView(user);
  if (state.route.name === "tags") return tagsView();
  return homeView(user);
}

function homeView(user) {
  const notifications = state.notifications
    .filter((notification) => notification.to === user.id && !notification.read)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return `
    <section class="home-grid">
      <div class="home-main">
        <button class="search-box search-entry" type="button" data-route="search">
          <span>検索</span>
          <strong>${state.query.trim() ? escapeHtml(state.query) : "学生、興味、プロジェクトを検索"}</strong>
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
        <button class="recommend-button" type="button" data-list="recommendations">
          <span>
            <strong>おすすめの人物</strong>
            <small>趣味・興味分野が近い人</small>
          </span>
          <em>${getRecommendedProfiles(user).length}</em>
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
          <input id="searchInput" type="search" value="${escapeAttr(state.query)}" placeholder="化学、#音楽、2年生、プロジェクト..." autocomplete="off" autofocus />
        </label>
      </div>
      <section class="section-block search-results-block">
        <div class="section-head">
          <h2 id="searchResultTitle">${state.query.trim() ? "検索結果" : "キーワードを入力"}</h2>
          <span id="searchResultCount">${state.query.trim() ? `${searchProfiles(state.query, user.id).length}件` : ""}</span>
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
          <button class="primary-button" id="saveProfileButton" type="submit">${state.saving ? "保存中..." : "保存"}</button>
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
  if (kind === "recommendations") return recommendationsView(user);

  const config = {
    wantsMe: ["あなたと話したい人", state.wants.filter((want) => want.to === user.id).map((want) => want.from)],
    myWants: ["自分の話したい人リスト", state.wants.filter((want) => want.from === user.id).map((want) => want.to)],
    history: ["閲覧履歴", state.visits.filter((visit) => visit.viewer === user.id).sort(sortByDate).map((visit) => visit.viewed)],
    footprints: ["足あと", state.visits.filter((visit) => visit.viewed === user.id).sort(sortByDate).slice(0, 20).map((visit) => visit.viewer)],
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

function recommendationsView(user) {
  const rows = getRecommendedProfiles(user);
  return `
    <section class="page-panel">
      <div class="page-head">
        <div>
          <p class="label">Recommend</p>
          <h1>おすすめの人物</h1>
        </div>
        <button class="icon-button" type="button" data-route="home">戻る</button>
      </div>
      <div class="person-list">
        ${
          rows
            .map((item) => recommendedPersonRow(item.profile, user.id, item.matchedTags))
            .join("") || emptyState("一致する趣味・興味分野のユーザーがまだいません")
        }
      </div>
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

function bindAuth() {
  document.querySelectorAll("[data-auth-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authScreen = button.dataset.authScreen;
      state.authMessage = "";
      state.authError = "";
      render();
    });
  });

  document.getElementById("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    const password = document.getElementById("passwordInput").value;
    const passwordConfirm = document.getElementById("passwordConfirmInput")?.value || "";
    const error = document.getElementById("loginError");
    error.textContent = "";

    if (!email.includes(KAMIYAMA_DOMAIN)) {
      error.textContent = `${KAMIYAMA_DOMAIN} を含むメールアドレスのみログインできます。`;
      return;
    }

    if (state.authScreen === "signup") {
      if (password.length < 8) {
        error.textContent = "パスワードは8文字以上で入力してください。";
        return;
      }
      if (password !== passwordConfirm) {
        error.textContent = "パスワード確認が一致していません。";
        return;
      }
    }

    state.authMessage = "";
    state.authError = "";
    render();

    const authResult = state.authScreen === "login"
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({ email, password });

    if (authResult.error) {
      state.authError = formatAuthError(authResult.error.message);
      render();
      return;
    }

    if (state.authScreen === "signup") {
      if (authResult.data.session) {
        state.authMessage = "新規登録が完了しました。ログイン状態に切り替わります。";
      } else {
        state.authMessage = "新規登録は完了しました。Supabase の Confirm email が ON なら、Auth の設定で OFF にするか確認メールを承認してからログインしてください。";
        state.authScreen = "login";
        render();
      }
    }
  });
}

function bindCommon() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      state.route = { name: button.dataset.route };
      render();
    });
  });
}

function bindRoute() {
  bindProfileRows();

  document.querySelectorAll("[data-list]").forEach((button) => {
    button.addEventListener("click", () => {
      state.route = { name: "list", kind: button.dataset.list };
      render();
    });
  });

  document.getElementById("searchInput")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderSearchResults();
  });

  bindSearchSuggestions();
  bindTagSearch();

  document.querySelector("[data-action='readNotifications']")?.addEventListener("click", async () => {
    const current = currentUser();
    if (!current) return;

    const unreadIds = state.notifications.filter((notice) => notice.to === current.id && !notice.read).map((notice) => notice.id);
    if (!unreadIds.length) return;

    const { error } = await supabaseClient.from("notifications").update({ read: true }).in("id", unreadIds);
    if (error) {
      showToast("通知を更新できませんでした");
      return;
    }

    await loadAppData();
    render();
  });

  document.querySelector("[data-action='toggleWant']")?.addEventListener("click", async (event) => {
    await toggleWant(currentUser().id, event.currentTarget.dataset.id);
  });

  bindProfileForm();
}

function bindProfileRows() {
  document.querySelectorAll("[data-profile]").forEach((row) => {
    row.addEventListener("click", async () => {
      const current = currentUser();
      if (!current) return;

      const profileId = row.dataset.profile;
      if (profileId !== current.id) {
        await recordVisit(current.id, profileId);
      }

      state.route = { name: "profile", id: profileId };
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

  const matchedProfiles = searchProfiles(state.query, user.id);
  title.textContent = state.query.trim() ? "検索結果" : "キーワードを入力";
  count.textContent = state.query.trim() ? `${matchedProfiles.length}件` : "";
  results.innerHTML = searchResultsMarkup(user);
  bindProfileRows();
  bindSearchSuggestions();
}

function bindSearchSuggestions() {
  document.querySelectorAll("[data-suggest]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("searchInput");
      state.query = button.dataset.suggest;
      if (input) input.value = state.query;
      renderSearchResults();
      input?.focus();
    });
  });
}

function bindTagSearch() {
  document.querySelectorAll("[data-tag-search]").forEach((button) => {
    button.addEventListener("click", () => {
      state.query = button.dataset.tagSearch;
      state.route = { name: "search" };
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

    state.saving = true;
    render();

    const { error } = await supabaseClient.from("profiles").update({
      photo_url: next.photo,
      nickname: next.nickname,
      grade: next.grade,
      hometown: next.hometown,
      hobbies: next.hobbies,
      interests: next.interests,
      project: next.project,
      sp: next.sp,
      effort: next.effort,
      message: next.message,
      mbti: next.mbti,
      sns: next.sns,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    state.saving = false;

    if (error) {
      console.error(error);
      showToast("プロフィールを保存できませんでした");
      render();
      return;
    }

    await loadAppData();
    showToast("プロフィールを保存しました");
    state.route = { name: "home" };
    render();
  });
}

async function toggleWant(from, to) {
  const target = byId(to);
  const fromProfile = byId(from);
  if (!target || !fromProfile) return;

  if (hasWant(from, to)) {
    const { error } = await supabaseClient.from("want_links").delete().match({ from_user: from, to_user: to });
    if (error) {
      console.error(error);
      showToast("更新できませんでした");
      return;
    }
    await loadAppData();
    showToast("話したい人から解除しました");
    render();
    return;
  }

  const { error: wantError } = await supabaseClient.from("want_links").insert({
    from_user: from,
    to_user: to,
  });

  if (wantError) {
    console.error(wantError);
    showToast("登録できませんでした");
    return;
  }

  const reciprocal = hasWant(to, from);
  const notificationsToInsert = [
    {
      to_user: to,
      from_user: from,
      type: reciprocal ? "match" : "want",
      text: reciprocal
        ? `${fromProfile.nickname}さんとマッチしました`
        : `${fromProfile.nickname}さんがあなたを話したい人に登録しました`,
      read: false,
    },
  ];

  if (reciprocal) {
    notificationsToInsert.push({
      to_user: from,
      from_user: to,
      type: "match",
      text: `${target.nickname}さんとマッチしました`,
      read: false,
    });
  }

  const { error: notificationError } = await supabaseClient.from("notifications").insert(notificationsToInsert);
  if (notificationError) {
    console.error(notificationError);
  }

  await loadAppData();
  showToast(reciprocal ? "マッチしました" : "話したい人に登録しました");
  render();
}

async function recordVisit(viewer, viewed) {
  if (viewer === viewed) return;

  const latest = state.visits.find((visit) => visit.viewer === viewer && visit.viewed === viewed);
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < 60 * 1000) return;

  const { error } = await supabaseClient.from("profile_visits").insert({
    viewer_id: viewer,
    viewed_id: viewed,
  });

  if (error) {
    console.error(error);
    return;
  }

  await loadAppData();
}

function searchProfiles(term, currentId) {
  const normalized = term.trim().toLowerCase().replace(/^#/, "");
  if (!normalized) return [];

  return state.profiles
    .filter((profile) => profile.id !== currentId)
    .map((profile) => ({ profile, score: searchScore(profile, normalized) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.nickname.localeCompare(b.profile.nickname, "ja"))
    .map((item) => item.profile);
}

function searchResultsMarkup(user) {
  if (!state.query.trim()) {
    return `
      <div class="search-suggestions">
        ${["#化学", "#音楽", "#起業", "2年生", "教育", "プロジェクト"].map((term) => `<button type="button" data-suggest="${escapeAttr(term)}">${escapeHtml(term)}</button>`).join("")}
      </div>
      ${emptyState("検索したい言葉を入力してください")}
    `;
  }

  const results = searchProfiles(state.query, user.id);
  return results.map((profile) => personRow(profile, user.id)).join("") || emptyState("一致するユーザーがいません");
}

function searchScore(profile, term) {
  const exactFields = [...profile.hobbies, ...profile.interests, ...extractHashtags(profile.project)].map((tag) =>
    tag.replace(/^#/, "").toLowerCase()
  );
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

function getRecommendedProfiles(user) {
  const ownTags = new Set(getProfileRecommendationTags(user).map(normalizeTagForCompare));
  if (!ownTags.size) return [];

  return state.profiles
    .filter((profile) => profile.id !== user.id)
    .map((profile) => {
      const matchedTags = getProfileRecommendationTags(profile).filter((tag) =>
        ownTags.has(normalizeTagForCompare(tag))
      );
      return {
        profile,
        matchedTags: Array.from(new Set(matchedTags)),
      };
    })
    .filter((item) => item.matchedTags.length > 0)
    .sort(
      (a, b) =>
        b.matchedTags.length - a.matchedTags.length ||
        a.profile.nickname.localeCompare(b.profile.nickname, "ja")
    );
}

function getProfileRecommendationTags(profile) {
  return [...profile.hobbies, ...profile.interests].filter(Boolean);
}

function normalizeTagForCompare(tag) {
  return String(tag || "").trim().replace(/^#/, "").toLowerCase();
}

function createProfile(email) {
  const nickname = email.split("@")[0];
  return {
    id: "",
    email,
    photo: DEFAULT_AVATAR,
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
  return state.profiles.reduce(
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
            ? items
                .map(([tag, count]) => `<button type="button" data-tag-search="${escapeAttr(tag)}"><span>${escapeHtml(tag)}</span><small>${count}</small></button>`)
                .join("")
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
            ? items
                .map(([project, count]) => `<button type="button" data-tag-search="${escapeAttr(project)}"><span>${escapeHtml(project)}</span><small>${count}</small></button>`)
                .join("")
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
    ? state.visits.find((item) => item.viewer === userId && item.viewed === profile.id)
    : kind === "footprints"
      ? state.visits.find((item) => item.viewer === profile.id && item.viewed === userId)
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

function recommendedPersonRow(profile, userId, matchedTags) {
  const matched = isMatch(userId, profile.id);
  return `
    <button class="person-row recommend-row ${matched ? "matched" : ""}" type="button" data-profile="${profile.id}">
      ${avatar(profile)}
      <span>
        <strong>${escapeHtml(profile.nickname)}</strong>
        <small>${escapeHtml(profile.grade)} / 一致 ${matchedTags.length}件</small>
        <span class="matched-tags">${matchedTags.map((tag) => `<b>${escapeHtml(tag)}</b>`).join("")}</span>
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
  return state.wants.filter((want) => want.to === id).length;
}

function countMyWants(id) {
  return state.wants.filter((want) => want.from === id).length;
}

function countHistory(id) {
  return state.visits.filter((visit) => visit.viewer === id).length;
}

function countFootprints(id) {
  return Math.min(20, state.visits.filter((visit) => visit.viewed === id).length);
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
  if (!toastRoot) return;
  toastRoot.textContent = text;
  toastRoot.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastRoot.classList.remove("visible"), 2200);
}

function formatAuthError(message) {
  if (message === "Invalid login credentials") {
    return "メールアドレスまたはパスワードが違います。未登録なら新規登録から作成してください。";
  }
  if (message.includes("User already registered")) {
    return "このメールアドレスは既に登録されています。ログイン画面から入ってください。";
  }
  if (message.includes("Email rate limit exceeded")) {
    return "短時間に試行が多すぎます。少し待ってから再度試してください。";
  }
  return message;
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

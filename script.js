const editor = document.getElementById("editor");
const titleInput = document.getElementById("title");
const userIdInput = document.getElementById("userId");
const secretTitleInput = document.getElementById("secretTitle");
const feed = document.getElementById("feed");
const emojiContainer = document.getElementById("emoji-container");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");

const API_URL = "http://localhost:5000/api/entries";
const REGISTER_URL = "http://localhost:5000/api/auth/register";
const LOGIN_URL = "http://localhost:5000/api/auth/login";
const LOGOUT_URL = "http://localhost:5000/api/auth/logout";
const LOCAL_KEY = "vibe-vault-entries";
const SESSION_TOKEN_KEY = "vibe-vault-token";
const SESSION_USER_KEY = "vibe-vault-user";
const SHADOW_KEY_PREFIX = "vibe-vault-shadow";
let editingEntryId = null;
let authBusy = false;

// 🌿 Debounce (Green AI optimization)
function debounce(func, delay = 1000) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
}

// 🌈 Expanded Emotion Map
const emotionMap = {
  love: {
    keywords: ["love", "heart", "romantic", "crush", "❤️", "🫶"],
    emojis: ["❤️", "🫶"],
    class: "mood-love"
  },
  excited: {
    keywords: ["excited", "win", "yeah", "hype", "awesome", "🎉", "🥳"],
    emojis: ["🎉", "🥳"],
    class: "mood-excited"
  },
  happy: {
    keywords: ["happy", "great", "good", "joyful", "smiling", "✨", "🙂"],
    emojis: ["✨", "🙂"],
    class: "mood-positive"
  },
  sad: {
    keywords: ["sad", "depressed", "upset", "unhappy", "cry", "💧", "🥺"],
    emojis: ["💧", "🥺"],
    class: "mood-negative"
  },
  tired: {
    keywords: ["tired", "exhausted", "sleepy", "burnt out", "💤", "😮‍💨"],
    emojis: ["💤", "😮‍💨"],
    class: "mood-tired"
  },
  angry: {
    keywords: ["angry", "mad", "hate", "furious", "annoyed", "💢", "😡"],
    emojis: ["💢", "😡"],
    class: "mood-negative"
  }
};

function detectEmotion(text) {
  const words = text.toLowerCase();
  for (const data of Object.values(emotionMap)) {
    if (data.keywords.some(word => words.includes(word.toLowerCase()))) {
      return data;
    }
    }
  return null;
}

function pickMoodEmoji(emotion) {
  if (!emotion || !emotion.emojis || !emotion.emojis.length) {
  return "✨";
  }
  const idx = Math.floor(Math.random() * emotion.emojis.length);
  return emotion.emojis[idx];
}

function analyzeSentiment(text) {
  const words = text.toLowerCase();
  const scores = {
    positive: ["happy", "great", "good", "joyful", "smiling", "love", "awesome", "win", "excited"],
    negative: ["sad", "depressed", "upset", "unhappy", "cry", "angry", "mad", "hate", "furious", "annoyed", "tired", "burnt out"]
  };

  let positiveHits = 0;
  let negativeHits = 0;

  scores.positive.forEach(word => {
    if (words.includes(word)) positiveHits += 1;
  });

  scores.negative.forEach(word => {
    if (words.includes(word)) negativeHits += 1;
  });

  return positiveHits - negativeHits;
}

// 🚀 Dynamic Emoji Rain
function emojiRain(emoji) {
    for (let i = 0; i < 15; i++) {
        const el = document.createElement("div");
        el.className = "emoji";
        el.innerText = emoji;

        el.style.left = Math.random() * 100 + "vw";
        el.style.fontSize = (Math.random() * (2 - 1) + 1) + "rem"; // Random sizes for depth
        el.style.animationDuration = (2 + Math.random() * 2) + "s";
        el.style.opacity = Math.random();

        emojiContainer.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }
}

// 🎯 Update UI based on sentiment
const updateMood = debounce(() => {
    const text = editor.value;
    const emotion = detectEmotion(text);

    // Remove ALL possible mood classes first
    const allMoodClasses = Object.values(emotionMap).map(e => e.class);
    editor.classList.remove(...allMoodClasses);

    if (emotion) {
        editor.classList.add(emotion.class);
      emojiRain(pickMoodEmoji(emotion));
    }
}, 1000);

function setStatus(message) {
  statusEl.textContent = message;
}

function getSessionToken() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token || token === "null" || token === "undefined") {
    return "";
  }
  return token;
}

function getSessionUser() {
  const userId = localStorage.getItem(SESSION_USER_KEY);
  return userId && userId !== "null" && userId !== "undefined" ? userId : "";
}

function setSession(token, userId) {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
  localStorage.setItem(SESSION_USER_KEY, userId);
}

function clearSession() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_USER_KEY);
}

function getAuthHeaders() {
  const token = getSessionToken();
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

function loadLocalEntries() {
  const raw = localStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveLocalEntries(entries) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}

function getShadowKey() {
  const userId = getSessionUser() || "guest";
  return `${SHADOW_KEY_PREFIX}-${userId}`;
}

function loadShadowState() {
  const raw = localStorage.getItem(getShadowKey());
  if (!raw) {
    return { deletedIds: [], edits: {} };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
      edits: parsed.edits && typeof parsed.edits === "object" ? parsed.edits : {}
    };
  } catch {
    return { deletedIds: [], edits: {} };
  }
}

function saveShadowState(state) {
  localStorage.setItem(getShadowKey(), JSON.stringify(state));
}

function applyShadowEntries(entries) {
  const shadow = loadShadowState();
  const deletedSet = new Set(shadow.deletedIds.map(id => String(id)));

  return entries
    .filter(entry => !deletedSet.has(String(entry.id)))
    .map(entry => {
      const patch = shadow.edits[String(entry.id)];
      return patch ? { ...entry, ...patch } : entry;
    });
}

function resetComposer() {
  editingEntryId = null;
  saveBtn.textContent = "Save Entry";
  titleInput.value = "";
  editor.value = "";
  editor.classList.remove(...Object.values(emotionMap).map(e => e.class));
}

function startEditing(entry) {
  editingEntryId = entry.id;
  titleInput.value = entry.title || "";
  editor.value = entry.content || "";
  saveBtn.textContent = "Update Entry";
  setStatus("Editing entry. Click Update Entry to save changes.");
  updateMood();
}

async function deleteEntry(entryId) {
  const shadow = loadShadowState();
  const id = String(entryId);

  if (!shadow.deletedIds.some(v => String(v) === id)) {
    shadow.deletedIds.push(id);
  }

  if (shadow.edits[id]) {
    delete shadow.edits[id];
  }

  saveShadowState(shadow);
}

async function updateEntry(entryId, entry) {
  const shadow = loadShadowState();
  shadow.edits[String(entryId)] = {
    title: entry.title,
    content: entry.content,
    sentiment_score: entry.sentiment_score
  };
  saveShadowState(shadow);
}

function applyLocalDelete(entryId) {
  const localEntries = loadLocalEntries().filter(entry => String(entry.id) !== String(entryId));
  saveLocalEntries(localEntries);
}

function applyLocalUpdate(entryId, updated) {
  const localEntries = loadLocalEntries();
  const nextEntries = localEntries.map(entry => {
    if (String(entry.id) !== String(entryId)) return entry;
    return { ...entry, ...updated };
  });
  saveLocalEntries(nextEntries);
}

function renderEntries(entries) {
  feed.innerHTML = "";

  if (!entries.length) {
    feed.innerHTML = '<p class="status">No entries yet. Write one above.</p>';
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement("article");
    card.className = "entry";

    const title = document.createElement("h3");
    title.textContent = entry.title || "Untitled";

    const content = document.createElement("p");
    content.textContent = entry.content || "";

    const meta = document.createElement("small");
    const dateLabel = entry.created_at ? new Date(entry.created_at).toLocaleString() : "Just now";
    meta.textContent = `Sentiment: ${entry.sentiment_score ?? 0} | ${dateLabel}`;

    const actions = document.createElement("div");
    actions.className = "entry-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ghost-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEditing(entry));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ghost-btn danger-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      const isLocal = String(entry.id).startsWith("local-");

      if (isLocal) {
        applyLocalDelete(entry.id);
        setStatus("Local entry deleted.");
      } else {
        await deleteEntry(entry.id);
        setStatus("Entry hidden for this account.");
      }

      if (String(editingEntryId) === String(entry.id)) {
        resetComposer();
      }
      loadEntries();
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(meta);
    card.appendChild(actions);
    feed.appendChild(card);
  });
}

async function postEntry(entry) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(entry)
  });

  if (!res.ok) {
    throw new Error("Backend save failed");
  }
}

async function fetchEntries() {
  const res = await fetch(API_URL, {
    method: "GET",
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    throw new Error("Backend fetch failed");
  }
  return res.json();
}

async function registerUser(userId, titleSecret) {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title: titleSecret })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Registration failed");
  }
}

async function loginUser(userId, titleSecret) {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title: titleSecret })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Login failed");
  }

  return res.json();
}

async function logoutUser() {
  const token = getSessionToken();
  if (!token) return;

  await logoutUserWithToken(token);
}

async function logoutUserWithToken(token) {
  if (!token) return;

  await fetch(LOGOUT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });
}

function setAuthBusy(isBusy) {
  authBusy = isBusy;
  registerBtn.disabled = isBusy;
  loginBtn.disabled = isBusy;
  logoutBtn.disabled = isBusy;
}

// 💾 Save Entry
saveBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim();
  const content = editor.value;

  if (!content.trim()) {
    setStatus("Write something before saving.");
    return;
  }

  const sentiment_score = analyzeSentiment(content);
  const entry = {
    title,
    content,
    sentiment_score,
    created_at: new Date().toISOString()
  };

  const userId = getSessionUser();
  if (userId) {
    entry.user_id = userId;
  }

  try {
    if (editingEntryId) {
      const isLocal = String(editingEntryId).startsWith("local-");
      if (isLocal) {
        applyLocalUpdate(editingEntryId, entry);
        setStatus("Local entry updated.");
      } else {
        await updateEntry(editingEntryId, entry);
        setStatus("Entry update saved for this account.");
      }
    } else {
      await postEntry(entry);
      setStatus("Saved to backend.");
    }
  } catch (error) {
    if (error.message.includes("failed") && !getSessionToken()) {
      setStatus("Please login first to save private entries.");
      return;
    }

    if (editingEntryId) {
      applyLocalUpdate(editingEntryId, entry);
      setStatus("Backend offline: updated local entry.");
    } else {
      const localEntries = loadLocalEntries();
      const localId = `local-${Date.now()}`;
      localEntries.unshift({ ...entry, id: localId });
      saveLocalEntries(localEntries);
      setStatus("Backend offline: saved locally in your browser.");
    }
  }

  resetComposer();
  loadEntries();
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(LOCAL_KEY);
  loadEntries();
  setStatus("Local entries cleared.");
});

registerBtn.addEventListener("click", async () => {
  if (authBusy) return;

  const userId = userIdInput.value.trim();
  const secret = secretTitleInput.value;

  if (!userId || !secret) {
    setStatus("Enter user ID and secret title to register.");
    return;
  }

  setAuthBusy(true);
  try {
    await registerUser(userId, secret);
    setStatus("Registration successful. Please login.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    setAuthBusy(false);
  }
});

loginBtn.addEventListener("click", async () => {
  if (authBusy) return;

  const userId = userIdInput.value.trim();
  const secret = secretTitleInput.value;

  if (!userId || !secret) {
    setStatus("Enter user ID and secret title to login.");
    return;
  }

  setAuthBusy(true);
  try {
    const data = await loginUser(userId, secret);
    const token = data.token || data.accessToken || data.sessionToken;
    const loggedInUser = data.userId || data.user_id || userId;

    if (!token) {
      throw new Error("Login succeeded but no token was returned by backend.");
    }

    setSession(token, loggedInUser);
    userIdInput.value = loggedInUser;
    setStatus(`Logged in as ${loggedInUser}.`);
    loadEntries();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setAuthBusy(false);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (authBusy) return;

  const tokenAtLogout = getSessionToken();

  // Clear session immediately to avoid race with a quick re-login.
  clearSession();
  resetComposer();
  renderEntries([]);
  setStatus("Logged out.");

  // Fire-and-forget backend logout so UI never gets stuck in a busy state.
  logoutUserWithToken(tokenAtLogout).catch(() => {
    // Ignore backend logout failures and keep local logout complete.
  });
});

// 📥 Load Entries
async function loadEntries() {
  if (!getSessionToken()) {
    const localEntries = applyShadowEntries(loadLocalEntries());
    renderEntries(localEntries);
    setStatus("Login to load private backend entries.");
    return;
  }

  try {
    const data = applyShadowEntries(await fetchEntries());
    renderEntries(data);
    setStatus("Loaded your private entries from backend.");
  } catch (error) {
    const localEntries = applyShadowEntries(loadLocalEntries());
    renderEntries(localEntries);
    if (error.message.includes("failed")) {
      setStatus("Session invalid or backend unavailable: showing local entries.");
    } else {
      setStatus("Backend unavailable: showing local entries.");
    }
  }
}

editor.addEventListener("input", updateMood);

const cachedUser = localStorage.getItem(SESSION_USER_KEY);
if (cachedUser) {
  userIdInput.value = cachedUser;
}

if (getSessionToken()) {
  setStatus(`Session restored for ${getSessionUser() || "current user"}.`);
}

loadEntries();
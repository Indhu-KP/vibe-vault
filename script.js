const editor = document.getElementById("editor");
const titleInput = document.getElementById("title");
const feed = document.getElementById("feed");
const emojiContainer = document.getElementById("emoji-container");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

const API_URL = "http://localhost:5000/api/entries";
const LOCAL_KEY = "vibe-vault-entries";

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

function loadLocalEntries() {
  const raw = localStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveLocalEntries(entries) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
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

    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(meta);
    feed.appendChild(card);
  });
}

async function postEntry(entry) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });

  if (!res.ok) {
    throw new Error("Backend save failed");
  }
}

async function fetchEntries() {
  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error("Backend fetch failed");
  }
  return res.json();
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

  try {
    await postEntry(entry);
    setStatus("Saved to backend.");
  } catch (error) {
    const localEntries = loadLocalEntries();
    localEntries.unshift(entry);
    saveLocalEntries(localEntries);
    setStatus("Backend offline: saved locally in your browser.");
  }

  titleInput.value = "";
  editor.value = "";
  editor.classList.remove(...Object.values(emotionMap).map(e => e.class));
  loadEntries();
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(LOCAL_KEY);
  loadEntries();
  setStatus("Local entries cleared.");
});

// 📥 Load Entries
async function loadEntries() {
  try {
    const data = await fetchEntries();
    renderEntries(data);
    setStatus("Loaded from backend.");
  } catch (error) {
    const localEntries = loadLocalEntries();
    renderEntries(localEntries);
    setStatus("Backend unavailable: showing local entries.");
  }
}

editor.addEventListener("input", updateMood);
loadEntries();
// public/loader.js

// Helper to show/hide loader overlay
function showLoader(show = true) {
  let overlay = document.getElementById("loader-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loader-overlay";
    overlay.className = "loader-overlay";
    overlay.innerHTML = `<div class="loader"></div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display = show ? "flex" : "none";
}
showLoader(false);

// Helper to show error messages
function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

// Helper to show login/register messages
function showMsg(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

// Helper to get the user's URLs and render
function loadUrls() {
  showLoader(true);
  fetch("/api/my-urls")
    .then((r) => {
      showLoader(false);
      if (!r.ok) throw new Error("Failed to load URLs");
      return r.json();
    })
    .then((data) => {
      if (data.urls) renderUrls(data.urls);
    })
    .catch((e) => {
      showLoader(false);
      showError("Could not load URLs.");
    });
}

// Render only the short URLs in the user's list
function renderUrls(urls) {
  const ul = document.getElementById("url-list");
  ul.innerHTML = "";
  urls.forEach(({ id }) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="/${id}" target="_blank">${location.origin}/${id}</a>`;
    ul.appendChild(li);
  });
}

// Helper to update UI on login state
function setLoggedIn(username) {
  document.getElementById("shorten-form").classList.remove("hidden");
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("register-form").classList.add("hidden");
  document.getElementById("urls").classList.remove("hidden");
  document.getElementById("logout-btn").classList.remove("hidden");
  document.getElementById("username-label").textContent = username;
  loadUrls();
}

function setLoggedOut() {
  document.getElementById("shorten-form").classList.add("hidden");
  document.getElementById("login-form").classList.remove("hidden");
  document.getElementById("register-form").classList.add("hidden");
  document.getElementById("urls").classList.add("hidden");
  document.getElementById("logout-btn").classList.add("hidden");
  document.getElementById("username-label").textContent = "";
  document.getElementById("url-list").innerHTML = "";
  document.getElementById("result-box").style.display = "none";
}

// ------ Event Handlers ------

// Login handler
document.getElementById("login-form").onsubmit = function (e) {
  e.preventDefault();
  showLoader(true);
  const username = this.username.value.trim();
  const password = this.password.value;
  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((r) => r.json())
    .then((data) => {
      showLoader(false);
      if (data.success) {
        setLoggedIn(data.username);
      } else {
        showMsg("login-msg", data.error || "Login failed.");
      }
    })
    .catch(() => {
      showLoader(false);
      showMsg("login-msg", "Network error.");
    });
};

// Register handler
document.getElementById("register-form").onsubmit = function (e) {
  e.preventDefault();
  showLoader(true);
  const username = this.username.value.trim();
  const password = this.password.value;
  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((r) => r.json())
    .then((data) => {
      showLoader(false);
      if (data.success) {
        setLoggedIn(data.username);
      } else {
        showMsg("register-msg", data.error || "Registration failed.");
      }
    })
    .catch(() => {
      showLoader(false);
      showMsg("register-msg", "Network error.");
    });
};

// Switch between login and register forms
document.getElementById("to-register").onclick = function () {
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("register-form").classList.remove("hidden");
  document.getElementById("register-form").reset();
  showMsg("login-msg", "");
  showMsg("register-msg", "");
};
document.getElementById("to-login").onclick = function () {
  document.getElementById("register-form").classList.add("hidden");
  document.getElementById("login-form").classList.remove("hidden");
  document.getElementById("login-form").reset();
  showMsg("login-msg", "");
  showMsg("register-msg", "");
};

// Logout handler
document.getElementById("logout-btn").onclick = function () {
  showLoader(true);
  fetch("/api/logout", { method: "POST" })
    .then(() => {
      showLoader(false);
      setLoggedOut();
    })
    .catch(() => {
      showLoader(false);
      setLoggedOut();
    });
};

// URL shortener handler
document.getElementById("shorten-form").onsubmit = function (e) {
  e.preventDefault();
  showError("");
  showLoader(true);
  const originalUrl = this.originalUrl.value.trim();
  fetch("/api/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originalUrl }),
  })
    .then((r) => r.json())
    .then((data) => {
      showLoader(false);
      if (data.shortUrl) {
        showShortUrl(data.shortUrl);
        loadUrls();
        document.getElementById("shorten-form").reset();
      } else {
        showError(data.error || "Shortening failed.");
      }
    })
    .catch(() => {
      showLoader(false);
      showError("Network error.");
    });
};

// Show result short URL in result box
function showShortUrl(url) {
  const resultBox = document.getElementById("result-box");
  const input = document.getElementById("short-url-input");
  input.value = url;
  resultBox.style.display = "flex";
}

// Copy button handler
document.getElementById("copy-btn").onclick = function () {
  const input = document.getElementById("short-url-input");
  input.select();
  input.setSelectionRange(0, 9999);
  document.execCommand("copy");
  this.classList.add("copied");
  this.textContent = "Copied!";
  setTimeout(() => {
    this.classList.remove("copied");
    this.textContent = "Copy";
  }, 900);
};

// On load: check login state
window.onload = function () {
  showLoader(true);
  fetch("/api/my-urls")
    .then((r) => r.json())
    .then((data) => {
      showLoader(false);
      if (data.urls) {
        setLoggedIn(data.username || "User");
      } else {
        setLoggedOut();
      }
    })
    .catch(() => {
      showLoader(false);
      setLoggedOut();
    });
};

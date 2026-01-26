// Core FilmBox interactions
const SESSION_KEY = "filmbox_session";

// API Configuration
// Для локальной разработки: http://localhost:3000
// Для продакшена: Railway сервер
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://filmbox-backend-production.up.railway.app';

// Изображения загружаются через наш прокси (обход блокировки TMDB)
const IMAGE_PROXY_BASE = `${API_BASE_URL}/api/image/w500`;

// Кэш для загруженных фильмов
let moviesCache = [];

// Проверяет, содержит ли текст только кириллицу, латиницу и базовые символы
function isReadableTitle(text) {
  if (!text) return false;
  // Разрешаем кириллицу, латиницу, цифры, пробелы и базовую пунктуацию
  return /^[\u0400-\u04FFa-zA-Z0-9\s\-:,.!?'"()]+$/.test(text);
}

// Функция для получения популярных фильмов (через наш бэкенд-прокси)
async function fetchPopularMovies(page = 1) {
  try {
    // Получаем данные на русском через наш прокси
    const response = await fetch(
      `${API_BASE_URL}/api/movies/popular?language=ru-RU&page=${page}`
    );
    const data = await response.json();
    
    // Также получаем английские данные для резерва
    const responseEn = await fetch(
      `${API_BASE_URL}/api/movies/popular?language=en-US&page=${page}`
    );
    const dataEn = await responseEn.json();
    
    // Создаём карту английских названий по ID
    const enTitles = {};
    if (dataEn.results) {
      dataEn.results.forEach(m => {
        enTitles[m.id] = m.title;
      });
    }
    
    return (data.results || []).map(movie => transformMovie(movie, enTitles[movie.id]));
  } catch (error) {
    console.error("Ошибка загрузки фильмов:", error);
    return [];
  }
}

// Функция для получения деталей фильма (через наш бэкенд-прокси)
async function fetchMovieDetails(movieId) {
  try {
    // Получаем на русском через наш прокси
    const response = await fetch(
      `${API_BASE_URL}/api/movies/${movieId}?language=ru-RU`
    );
    const data = await response.json();
    
    // Получаем английское название
    const responseEn = await fetch(
      `${API_BASE_URL}/api/movies/${movieId}?language=en-US`
    );
    const dataEn = await responseEn.json();
    
    return transformMovie(data, dataEn.title);
  } catch (error) {
    console.error("Ошибка загрузки деталей фильма:", error);
    return null;
  }
}

// Преобразование данных TMDB в формат приложения
function transformMovie(movie, englishTitle = null) {
  // Генерируем цену на основе рейтинга и популярности
  const basePrice = 790;
  const ratingBonus = Math.round((movie.vote_average || 7) * 50);
  const price = basePrice + ratingBonus;
  
  // Выбираем название: русское если читаемое, иначе английское
  let title = movie.title;
  if (!isReadableTitle(title)) {
    title = englishTitle || movie.original_title || movie.title;
  }
  
  return {
    id: movie.id,
    title: title,
    genre: movie.genres 
      ? movie.genres.map(g => g.name).join(" / ") 
      : (movie.genre_ids ? "Фильм" : "Фильм"),
    price: price,
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : "N/A",
    rating: movie.vote_average ? movie.vote_average.toFixed(1) : "N/A",
    poster: movie.poster_path 
      ? `${IMAGE_PROXY_BASE}${movie.poster_path}` 
      : "https://via.placeholder.com/500x750?text=No+Poster",
    summary: movie.overview || "Описание отсутствует.",
    backdrop: movie.backdrop_path 
      ? `${IMAGE_PROXY_BASE}${movie.backdrop_path}` 
      : null,
  };
}

// Статический fallback массив (на случай если API недоступен)
const fallbackProducts = [
  {
    id: "blade",
    title: "Бегущий по лезвию 2049",
    genre: "Научная фантастика / Триллер",
    price: 1190,
    year: 2017,
    rating: 8.0,
    poster: "https://images.unsplash.com/photo-1523798724326-d0c5df28c235?auto=format&fit=crop&w=600&q=80",
    summary: "Инспектор К раскрывает тайну, способную обрушить остатки цивилизованного мира.",
  },
  {
    id: "dune",
    title: "Дюна",
    genre: "Научная фантастика / Драма",
    price: 1290,
    year: 2021,
    rating: 8.1,
    poster: "https://images.unsplash.com/photo-1542204615-9dd4b3c4e353?auto=format&fit=crop&w=600&q=80",
    summary: "Пол Атрейдес возглавляет воинов пустыни, чтобы освободить свой народ от гнёта Императора.",
  },
  {
    id: "matrix",
    title: "Матрица",
    genre: "Научная фантастика / Экшен",
    price: 990,
    year: 1999,
    rating: 8.7,
    poster: "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=600&q=80",
    summary: "Хакер узнаёт правду о реальности и вступает в войну против её создателей.",
  },
];

// Множители цен для разных форматов
const FORMAT_PRICES = {
  "digital-4k": 1.0,      // Базовая цена (100%)
  "digital-hd": 0.7,      // Full HD дешевле на 30%
  "digital-atmos": 1.2    // Atmos + субтитры дороже на 20%
};

// Названия форматов для отображения
const FORMAT_LABELS = {
  "digital-4k": "Цифровой 4K HDR",
  "digital-hd": "Цифровой Full HD",
  "digital-atmos": "Цифровой Atmos + субтитры",
};

let authMode = "login";

function showAuthForm(mode) {
  const loginForm = qs("#loginForm");
  const registerForm = qs("#registerForm");
  const loginTab = qs("#openLogin");
  const registerTab = qs("#openRegister");
  authMode = mode;
  if (!loginForm || !registerForm) return;
  if (mode === "register") {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    if (registerTab && loginTab) {
      registerTab.classList.remove("btn-ghost");
      registerTab.classList.add("btn-primary");
      loginTab.classList.remove("btn-primary");
      loginTab.classList.add("btn-ghost");
    }
  } else {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    if (registerTab && loginTab) {
      loginTab.classList.remove("btn-ghost");
      loginTab.classList.add("btn-primary");
      registerTab.classList.remove("btn-primary");
      registerTab.classList.add("btn-ghost");
    }
  }
}

function openAuthModal(mode = "login") {
  const modal = qs("#authModal");
  if (!modal) return;
  showAuthForm(mode);
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  const focusEl =
    mode === "register"
      ? qs("#registerForm input[name='name']")
      : qs("#loginForm input[name='loginEmail']");
  if (focusEl) focusEl.focus();
}

function closeAuthModal() {
  const modal = qs("#authModal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  const loginStatus = qs("#loginStatus");
  const registerStatus = qs("#registerStatus");
  if (loginStatus) loginStatus.innerHTML = "";
  if (registerStatus) registerStatus.innerHTML = "";
}

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

// Ключи для хранения в sessionStorage
const TOKEN_KEY = "filmbox_token";

// Управление JWT токеном и сессией
const session = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  get() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("Session read error", err);
      return null;
    }
  },
  set(user) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn("Session write error", err);
    }
  },
  clear() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
};

// Функция для запросов с JWT токеном
async function authFetch(url, options = {}) {
  const token = session.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, { ...options, headers });
}

function setStatus(el, message, type = "success") {
  if (!el) return;
  el.innerHTML = `<div class="alert ${type === "error" ? "error" : ""}">${message}</div>`;
}

function currentUser() {
  return session.get();
}

function renderUserBadge() {
  const badge = qs("#userBadge");
  const logoutBtn = qs("#logoutBtn");
  const loginBtn = qs("#loginBtnHeader");
  const registerBtn = qs("#registerBtnHeader");
  const user = currentUser();
  if (!badge) return;
  if (user) {
    badge.textContent = `Добро пожаловать, ${user.name}`;
    badge.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (loginBtn) loginBtn.classList.add("hidden");
    if (registerBtn) registerBtn.classList.add("hidden");
  } else {
    badge.textContent = "Гость";
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (registerBtn) registerBtn.classList.remove("hidden");
  }
}

async function registerUser(form) {
  const name = form.name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value.trim();
  const status = qs("#registerStatus");

  if (!name || !email || !password) {
    setStatus(status, "Заполните все поля", "error");
    return;
  }
  if (!email.includes("@")) {
    setStatus(status, "Некорректный email", "error");
    return;
  }
  
  // Валидация пароля (клиентская)
  if (password.length < 8) {
    setStatus(status, "Пароль должен содержать минимум 8 символов", "error");
    return;
  }
  if (!/[0-9]/.test(password)) {
    setStatus(status, "Пароль должен содержать минимум одну цифру", "error");
    return;
  }
  if (!/[A-Z]/.test(password)) {
    setStatus(status, "Пароль должен содержать минимум одну заглавную букву", "error");
    return;
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    setStatus(status, "Пароль должен содержать минимум один спец. символ", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(status, data.error || "Ошибка регистрации", "error");
      return;
    }

    // Сохраняем токен и данные пользователя
    session.setToken(data.token);
    session.set(data.user);
    location.reload();
  } catch (err) {
    console.error('Register error:', err);
    setStatus(status, "Ошибка соединения с сервером", "error");
  }
}

async function loginUser(form) {
  const email = form.loginEmail.value.trim().toLowerCase();
  const password = form.loginPassword.value.trim();
  const status = qs("#loginStatus");

  if (!email || !password) {
    setStatus(status, "Заполните все поля", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(status, data.error || "Неверные данные", "error");
      return;
    }

    // Сохраняем токен и данные пользователя
    session.setToken(data.token);
    session.set(data.user);
    location.reload();
  } catch (err) {
    console.error('Login error:', err);
    setStatus(status, "Ошибка соединения с сервером", "error");
  }
}

function logout() {
  session.clear();
  renderUserBadge();
  renderMobileUserBadge();
}

function attachAuthHandlers() {
  const registerForm = qs("#registerForm");
  const loginForm = qs("#loginForm");
  const logoutBtn = qs("#logoutBtn");
  const authModal = qs("#authModal");
  const modalClose = qs("#authModalClose");
  const openLogin = qs("#openLogin");
  const openRegister = qs("#openRegister");
  const headerLogin = qs("#loginBtnHeader");
  const headerRegister = qs("#registerBtnHeader");
  const switchToLogin = qsa(".open-login-switch");
  const switchToRegister = qsa(".open-register-switch");

  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      registerUser(registerForm);
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      loginUser(loginForm);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => logout());
  }

  if (headerLogin) {
    headerLogin.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthModal("login");
    });
  }

  if (headerRegister) {
    headerRegister.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthModal("register");
    });
  }

  // Кнопка регистрации на главной странице (hero секция)
  const heroRegisterBtn = qs("#heroRegisterBtn");
  if (heroRegisterBtn) {
    heroRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthModal("register");
    });
  }

  if (openLogin) {
    openLogin.addEventListener("click", () => openAuthModal("login"));
  }

  if (openRegister) {
    openRegister.addEventListener("click", () => openAuthModal("register"));
  }

  switchToLogin.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthModal("login");
    })
  );

  switchToRegister.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthModal("register");
    })
  );

  if (modalClose) {
    modalClose.addEventListener("click", () => closeAuthModal());
  }

  if (authModal) {
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }
}

async function renderProductGrid() {
  const container = qs("#productGrid");
  if (!container) return;
  
  // Показываем загрузку
  container.innerHTML = `
    <div class="col-span-full text-center py-12">
      <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-400">Загрузка фильмов...</p>
    </div>
  `;
  
  // Загружаем популярные фильмы из API (берём только 3 для главной)
  let movies = await fetchPopularMovies();
  
  if (movies.length === 0) {
    movies = fallbackProducts;
  }
  
  // Берём только первые 3 фильма для главной страницы
  const topMovies = movies.slice(0, 3);
  
  container.innerHTML = topMovies
    .map(
      (p) => `
        <article class="glass-card grid-card p-4 flex flex-col gap-4">
          <div class="poster-shadow aspect-[2/3] overflow-hidden rounded-lg">
            <img src="${p.poster}" alt="${p.title}" class="w-full h-full object-cover" loading="lazy" />
          </div>
          <div class="flex items-center justify-between text-sm text-slate-400">
            <span class="line-clamp-1">${p.genre}</span>
            <span><span class="star-list">★</span> ${p.rating}</span>
          </div>
          <h3 class="text-xl font-semibold line-clamp-1">${p.title}</h3>
          <p class="text-slate-400 text-sm leading-relaxed line-clamp-2">${p.summary}</p>
          <div class="flex items-center justify-between">
            <div class="text-lg font-semibold">от ${Math.round(p.price * 0.7)} ₽</div>
            <a href="product.html#${p.id}" class="btn-ghost">Подробнее</a>
          </div>
        </article>
      `
    )
    .join("\n");
}

async function renderFilmsCatalog() {
  const catalog = qs("#filmsCatalog");
  if (!catalog) return;
  
  // Показываем загрузку
  catalog.innerHTML = `
    <div class="col-span-full text-center py-12">
      <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-400">Загрузка фильмов...</p>
    </div>
  `;
  
  // Загружаем фильмы из API
  const movies = await fetchPopularMovies();
  
  if (movies.length === 0) {
    // Fallback на статические данные
    moviesCache = fallbackProducts;
  } else {
    // Берём только 9 фильмов для страницы каталога
    moviesCache = movies.slice(0, 9);
  }
  
  catalog.innerHTML = moviesCache
    .map(
      (p) => `
        <div class="glass-card grid-card overflow-hidden cursor-pointer film-card" data-film-id="${p.id}">
          <div class="poster-shadow aspect-[2/3] overflow-hidden">
            <img src="${p.poster}" alt="${p.title}" class="w-full h-full object-cover" loading="lazy" />
          </div>
          <div class="p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400 line-clamp-1">${p.genre}</span>
              <span class="text-xs text-slate-400"><span class="star-list">★</span> ${p.rating}</span>
            </div>
            <h3 class="font-semibold text-lg line-clamp-1">${p.title}</h3>
            <p class="text-sm text-slate-400 line-clamp-2">${p.summary}</p>
            <div class="flex items-center justify-between pt-2">
              <span class="font-bold text-lg">от ${Math.round(p.price * 0.7)} ₽</span>
              <span class="text-sm text-slate-400">${p.year}</span>
            </div>
            <button class="btn-primary w-full mt-2 select-film-btn" data-film-id="${p.id}">Выбрать</button>
          </div>
        </div>
      `
    )
    .join("\n");
  
  // Добавляем обработчики для выбора фильма
  qsa(".select-film-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const filmId = btn.dataset.filmId;
      selectFilm(filmId);
    });
  });
  
  qsa(".film-card").forEach((card) => {
    card.addEventListener("click", () => {
      const filmId = card.dataset.filmId;
      selectFilm(filmId);
    });
  });
}

async function selectFilm(filmId) {
  // Преобразуем в число, т.к. TMDB использует числовые ID
  const numericId = Number(filmId);
  
  // Сначала ищем в кэше
  let product = moviesCache.find((p) => p.id === numericId || p.id === filmId);
  
  // Если не найден в кэше, загружаем из API
  if (!product && !isNaN(numericId)) {
    product = await fetchMovieDetails(numericId);
    if (product) {
      moviesCache.push(product);
    }
  }
  
  if (!product) return;
  
  // Показываем секцию деталей
  const productSection = qs("#productSection");
  
  if (productSection) productSection.classList.remove("hidden");
  
  // Обновляем URL
  window.location.hash = filmId;
  
  // Обновляем детали фильма (форма заказа теперь внутри)
  await hydrateProductPage();
  
  // Прокручиваем к деталям фильма
  if (productSection) {
    productSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function hydrateProductPage() {
  const detailWrap = qs("#productDetail");
  if (!detailWrap) return;
  
  const id = window.location.hash.replace("#", "");
  
  // Если нет hash, не показываем детали (только каталог)
  if (!id) return;
  
  const numericId = Number(id);
  
  // Сначала ищем в кэше
  let product = moviesCache.find((p) => p.id === numericId || p.id === id);
  
  // Если не найден в кэше, загружаем из API
  if (!product && !isNaN(numericId)) {
    detailWrap.innerHTML = `
      <div class="text-center py-12">
        <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="mt-4 text-slate-400">Загрузка информации о фильме...</p>
      </div>
    `;
    product = await fetchMovieDetails(numericId);
    if (product) {
      moviesCache.push(product);
    }
  }
  
  if (!product) return;
  
  // Показываем секцию деталей
  const productSection = qs("#productSection");
  if (productSection) productSection.classList.remove("hidden");
  
  const price4k = product.price;
  const priceHd = Math.round(product.price * 0.7);
  const priceAtmos = Math.round(product.price * 1.2);
  
  detailWrap.innerHTML = `
    <div class="grid md:grid-cols-5 gap-8">
      <div class="md:col-span-2 poster-shadow">
        <img src="${product.poster}" alt="${product.title}" class="w-full h-full object-cover" loading="lazy" />
      </div>
      <div class="md:col-span-3 space-y-4">
        <div class="badge">${product.genre} · ${product.year}</div>
        <h1 class="text-3xl md:text-4xl font-bold">${product.title}</h1>
        <p class="text-slate-300 leading-relaxed">${product.summary}</p>
        <div class="flex items-center gap-4 text-lg">
          <span class="text-2xl font-semibold">от ${priceHd} ₽</span>
          <span class="text-slate-400"><span class="star-detail">★</span> ${product.rating} рейтинг</span>
        </div>
        <div class="glass-card p-4 space-y-3">
          <h3 class="font-semibold text-lg">Выберите формат</h3>
          <div class="flex gap-3 flex-wrap" id="formatSelection">
            <label class="btn-ghost flex items-center gap-2 format-option">
              <input type="radio" name="filmFormat" value="digital-hd" checked class="accent-blue-500" /> 
              <span>Цифровой Full HD <span class="text-blue-400 font-semibold">${priceHd} ₽</span></span>
            </label>
            <label class="btn-ghost flex items-center gap-2 format-option">
              <input type="radio" name="filmFormat" value="digital-4k" class="accent-blue-500" /> 
              <span>Цифровой 4K HDR <span class="text-blue-400 font-semibold">${price4k} ₽</span></span>
            </label>
            <label class="btn-ghost flex items-center gap-2 format-option">
              <input type="radio" name="filmFormat" value="digital-atmos" class="accent-blue-500" /> 
              <span>Цифровой Atmos + субтитры <span class="text-blue-400 font-semibold">${priceAtmos} ₽</span></span>
            </label>
          </div>
          <p class="text-sm text-slate-400">Мгновенная цифровая выдача после оплаты, без физических носителей.</p>
        </div>
        
        <!-- Оформление заказа -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="font-semibold text-lg">Оформление заказа</h3>
          <form id="purchaseForm" data-price="${product.price}" data-product="${product.title}" data-film-id="${product.id}" class="space-y-3">
            <div class="flex items-center justify-between text-lg">
              <span class="text-slate-400">Выбранный формат:</span>
              <span id="selectedFormatName" class="font-semibold">Цифровой Full HD</span>
            </div>
            <div class="flex items-center justify-between text-lg">
              <span class="text-slate-400">Итого</span>
              <span id="orderTotal" class="font-semibold text-xl">${priceHd} ₽</span>
            </div>
            <div id="purchaseStatus" class="status-placeholder"></div>
            <button class="btn-primary w-full" type="submit">Купить</button>
          </form>
        </div>
      </div>
    </div>
  `;
  
  // Инициализируем обработчики формы после рендера
  initPurchaseFormHandlers(product.price);
  
  // Прокручиваем к деталям фильма (с небольшой задержкой для рендера)
  setTimeout(() => {
    const productSection = qs("#productSection");
    if (productSection) {
      productSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 100);
}

function initPurchaseFormHandlers(basePrice) {
  const form = qs("#purchaseForm");
  const totalEl = qs("#orderTotal");
  const formatNameEl = qs("#selectedFormatName");
  const status = qs("#purchaseStatus");
  const formatInputs = qsa('input[name="filmFormat"]');
  
  if (!form || formatInputs.length === 0) return;

  const recalc = () => {
    const selectedFormat = qs('input[name="filmFormat"]:checked');
    if (!selectedFormat) return;
    
    const format = selectedFormat.value;
    const multiplier = FORMAT_PRICES[format] || 1.0;
    const price = Math.round(basePrice * multiplier);
    
    if (totalEl) totalEl.textContent = `${price} ₽`;
    if (formatNameEl) formatNameEl.textContent = FORMAT_LABELS[format] || format;
  };

  // Слушаем изменения формата
  formatInputs.forEach(input => {
    input.addEventListener("change", recalc);
  });
  
  recalc();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Проверяем авторизацию через токен
    const token = session.getToken();
    const currentSession = session.get();
    if (!token || !currentSession) {
      setStatus(status, "Войдите в аккаунт для оформления заказа", "error");
      return;
    }
    
    const selectedFormat = qs('input[name="filmFormat"]:checked');
    const format = selectedFormat ? selectedFormat.value : "digital-hd";
    const multiplier = FORMAT_PRICES[format] || 1.0;
    const priceWithFormat = Math.round(basePrice * multiplier);
    const filmTitle = form.dataset.product || "film";
    const filmId = form.dataset.filmId || null;

    setStatus(status, "Оформление заказа...", "info");

    try {
      // Отправляем заказ на сервер с JWT токеном
      const response = await authFetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        body: JSON.stringify({
          filmTitle,
          filmId,
          format,
          quantity: 1,
          price: priceWithFormat,
          total: priceWithFormat
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setStatus(status, "Сессия истекла. Пожалуйста, войдите снова.", "error");
          session.clear();
          return;
        }
        setStatus(status, data.error || "Ошибка создания заказа", "error");
        return;
      }

      setStatus(status, "Заказ создан! Мы отправили письмо с деталями на " + currentSession.email);
    } catch (err) {
      console.error('Order error:', err);
      setStatus(status, "Ошибка соединения с сервером", "error");
    }
  });
}

function initPasswordToggle() {
  qsa(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", function () {
      const wrapper = this.closest(".password-wrapper");
      const input = wrapper.querySelector("input");
      const eyeIcon = this.querySelector(".eye-icon");
      const eyeOffIcon = this.querySelector(".eye-off-icon");
      
      if (input.type === "password") {
        input.type = "text";
        eyeIcon.classList.add("hidden");
        eyeOffIcon.classList.remove("hidden");
      } else {
        input.type = "password";
        eyeIcon.classList.remove("hidden");
        eyeOffIcon.classList.add("hidden");
      }
    });
  });
}

function highlightNav() {
  const page = document.body.dataset.page;
  qsa(".nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (href.includes(page)) {
      link.classList.add("active");
    }
  });
}

async function renderOrdersTable() {
  const table = qs("#ordersTable");
  if (!table) return;
  
  const token = session.getToken();
  const currentSession = session.get();
  if (!token || !currentSession) {
    table.innerHTML = "<p class=\"text-slate-400\">Войдите в аккаунт для просмотра заказов.</p>";
    return;
  }

  // Загружаем заказы с сервера (с JWT авторизацией)
  try {
    const response = await authFetch(`${API_BASE_URL}/api/orders`);
    const data = await response.json();
    
    if (response.status === 401 || response.status === 403) {
      table.innerHTML = "<p class=\"text-slate-400\">Сессия истекла. Пожалуйста, войдите снова.</p>";
      session.clear();
      return;
    }
    
    if (!response.ok || !data.orders || data.orders.length === 0) {
      table.innerHTML = "<p class=\"text-slate-400\">Нет оформленных заказов пока.</p>";
      return;
    }
    
    // Преобразуем серверные заказы в нужный формат
    const orders = data.orders.map(o => ({
      product: o.film_title,
      format: o.format,
      qty: o.quantity,
      total: o.total,
      email: currentSession.email
    }));
    
    renderOrdersList(table, orders);
  } catch (err) {
    console.error('Load orders error:', err);
    table.innerHTML = "<p class=\"text-slate-400\">Ошибка загрузки заказов. Проверьте соединение с сервером.</p>";
  }
}

function renderOrdersList(table, orders) {
  table.innerHTML = `
    <div class="table-wrapper">
      <table class="table-lite">
        <thead>
          <tr><th>Товар</th><th>Формат</th><th>Количество</th><th>Сумма</th><th>Email</th></tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o) => {
                const formatText = FORMAT_LABELS[o.format] || o.format;
                return `<tr><td>${o.product}</td><td>${formatText}</td><td>${o.qty}</td><td>${o.total} ₽</td><td>${o.email}</td></tr>`;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function initBurgerMenu() {
  const burgerBtn = qs("#burgerBtn");
  const mobileMenu = qs("#mobileMenu");
  
  if (!burgerBtn || !mobileMenu) return;
  
  burgerBtn.addEventListener("click", function() {
    this.classList.toggle("active");
    mobileMenu.classList.toggle("hidden");
    mobileMenu.classList.toggle("open");
  });
  
  // Закрыть меню при клике на ссылку
  qsa("#mobileMenu .nav-link").forEach(function(link) {
    link.addEventListener("click", function() {
      burgerBtn.classList.remove("active");
      mobileMenu.classList.add("hidden");
      mobileMenu.classList.remove("open");
    });
  });
  
  // Обработчики для мобильных кнопок авторизации
  const loginBtnMobile = qs("#loginBtnMobile");
  const registerBtnMobile = qs("#registerBtnMobile");
  const logoutBtnMobile = qs("#logoutBtnMobile");
  
  if (loginBtnMobile) {
    loginBtnMobile.addEventListener("click", function(e) {
      e.preventDefault();
      burgerBtn.classList.remove("active");
      mobileMenu.classList.add("hidden");
      mobileMenu.classList.remove("open");
      openAuthModal("login");
    });
  }
  
  if (registerBtnMobile) {
    registerBtnMobile.addEventListener("click", function(e) {
      e.preventDefault();
      burgerBtn.classList.remove("active");
      mobileMenu.classList.add("hidden");
      mobileMenu.classList.remove("open");
      openAuthModal("register");
    });
  }
  
  if (logoutBtnMobile) {
    logoutBtnMobile.addEventListener("click", function() {
      session.clear();
      renderUserBadge();
      renderMobileUserBadge();
      burgerBtn.classList.remove("active");
      mobileMenu.classList.add("hidden");
      mobileMenu.classList.remove("open");
    });
  }
}

function renderMobileUserBadge() {
  const badge = qs("#userBadgeMobile");
  const logoutBtn = qs("#logoutBtnMobile");
  const loginBtn = qs("#loginBtnMobile");
  const registerBtn = qs("#registerBtnMobile");
  const user = currentUser();
  
  if (!badge) return;
  
  if (user) {
    badge.textContent = "Привет, " + user.name;
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (loginBtn) loginBtn.classList.add("hidden");
    if (registerBtn) registerBtn.classList.add("hidden");
  } else {
    badge.textContent = "";
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (registerBtn) registerBtn.classList.remove("hidden");
  }
}

function initContactForm() {
  const form = qs("#contactForm");
  const status = qs("#contactStatus");
  if (!form) return;
  
  // Автозаполнение данными из аккаунта
  const currentSession = session.get();
  if (currentSession) {
    if (form.contactName) form.contactName.value = currentSession.name || "";
    if (form.contactEmail) form.contactEmail.value = currentSession.email || "";
  }
  
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const name = form.contactName.value.trim();
    const email = form.contactEmail.value.trim();
    const subject = form.contactSubject.value;
    const message = form.contactMessage.value.trim();
    
    if (!name || !email || !message) {
      setStatus(status, "Заполните все поля", "error");
      return;
    }
    
    // Имитация отправки (в реальном проекте здесь был бы запрос к серверу)
    setStatus(status, "Сообщение отправлено! Мы ответим вам в ближайшее время.");
    form.reset();
  });
}

async function init() {
  renderUserBadge();
  renderMobileUserBadge();
  attachAuthHandlers();
  renderProductGrid();
  await renderFilmsCatalog();
  await hydrateProductPage();
  highlightNav();
  renderOrdersTable();
  initPasswordToggle();
  initBurgerMenu();
  initContactForm();
}

document.addEventListener("DOMContentLoaded", init);

/* =================  LIBRARY CHECK & FALLBACK  ================= */
window.libCheckTimeout = setTimeout(function () {
  if (typeof jQuery === 'undefined') {
    var jq = document.createElement('script');
    jq.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
    document.head.appendChild(jq);
  }
  if (!document.querySelector('link[href*="bootstrap"]')) {
    var bsCss = document.createElement('link');
    bsCss.rel = 'stylesheet';
    bsCss.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    document.head.appendChild(bsCss);
  }
  if (!document.querySelector('link[href*="font-awesome"]')) {
    var faCss = document.createElement('link');
    faCss.rel = 'stylesheet';
    faCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(faCss);
  }
  if (typeof bootstrap === 'undefined') {
    var bs = document.createElement('script');
    bs.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
    document.head.appendChild(bs);
  }
  if (typeof Hls === 'undefined') {
    var hls = document.createElement('script');
    hls.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    document.head.appendChild(hls);
  }
}, 2000);

/* =================  GOOGLE CAST SETUP  ================= */
window.__onGCastApiAvailable = function (isAvailable) {
  window.isCastApiAvailable = isAvailable;
  console.log("Cast SDK Available:", isAvailable);
  if (isAvailable && window.app) {
    setTimeout(() => {
      if (typeof cast !== 'undefined' && cast.framework) {
        window.app.initCast();
      } else {
        console.warn("Cast SDK script loaded, but 'cast' object is missing (likely blocked by file:// protocol)");
      }
    }, 500);
  }
};

(function () {
  const isHttp = window.location.protocol.startsWith('http');
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

  if (isHttp && isChrome) {
    const script = document.createElement('script');
    script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    script.onerror = () => console.warn("Google Cast SDK failed to load (likely blocked or offline)");
    document.head.appendChild(script);
  } else {
    console.log("Cast SDK load skipped: " + (isHttp ? "non-chrome browser" : "local file context"));
  }
})();

class App {
  constructor() {
    window.app = this;
    this.lang = localStorage.getItem("lang") || "ru";
    this.playlists = JSON.parse(
      localStorage.getItem("playlists") || "[]"
    );
    this.epgs = JSON.parse(localStorage.getItem("epgs") || "[]");
    this.selectedPlaylistId = localStorage.getItem("selectedPlaylistId");
    this.selectedEpgId = localStorage.getItem("selectedEpgId");
    this.autoLoad = localStorage.getItem("autoLoad") === "true";
    this.enableEpg = localStorage.getItem("enableEpg") !== "false";
    this.cacheData = localStorage.getItem("cacheData") !== "false";
    this.favorites = JSON.parse(
      localStorage.getItem("favorites") || "[]"
    );
    this.history = JSON.parse(localStorage.getItem("history") || "[]");

    this.channels = [];
    this.categories = { "Избранное": [] };
    this.currentCategory = "";
    this.currentChannelIndex = 0;
    this.categoryChannels = [];
    this.hls = null;
    this.suppressVideoErrors = false;
    this.videoEvents = null;
    this.stallTimer = null;
    this.onCategorySearch = this.debounce(() => this.renderCategories(), 150);
    this.onChannelSearch = this.debounce(() => this.renderChannels(), 150);
    this.schedule = {};
    this.epgIcons = {};
    this.epgChannelNames = {};
    this.epgDisplayNameToId = {};
    this.id2info = {};
    this.norm2id = {};
    this.cacheVersion = "v2";
    this.db = null;
    this.epgLoadingPromise = null;
    this.epgLoadedForId = null;
    this.loadedPlaylistId = null;
    this.loadingState = { playlist: false, epg: false };
    this.epgMatchCache = new Map();
    this.isListView = localStorage.getItem("isListView") === "true";
    this.buildVariant = localStorage.getItem("buildVariant") || "android-touch";
    this.uiModePreference = localStorage.getItem("uiMode") || "auto";
    this.deviceMode = "mobile";
    this.tvFocusables = [];
    this.tvFocusIndex = -1;
    this.playlistCacheAgeMs = 24 * 60 * 60 * 1000;
    this.epgScheduleCacheAgeMs = 24 * 60 * 60 * 1000;
    this.epgMetaCacheAgeMs = 30 * 24 * 60 * 60 * 1000;
    this.epgRawCacheAgeMs = 24 * 60 * 60 * 1000;
    this.translations = {
      ru: {
        app_title: "IPTV Player Pro",
        manage_title: "Управление плейлистами",
        your_playlists: "Ваши плейлисты IPTV",
        manage_desc: "Выберите активный список, управляйте источниками и быстро переходите к просмотру.",
        btn_add: "Добавить",
        playlists: "Плейлисты",
        open_hint: "Нажмите на карточку для открытия",
        saved_playlists: "Сохранено плейлистов",
        available_epg: "Доступно EPG",
        cache_status: "Состояние кэша",
        auto_load: "Автозагрузка при старте",
        cache_data: "Кэшировать плейлист и EPG",
        enable_epg: "Включить EPG / расписание",
        epg_desc: "Если вам не нужно расписание, но нужна быстрая работа — выключите это.",
        btn_clear_cache: "Очистить кэш",
        btn_go_categories: "Перейти к категориям",
        btn_back: "Назад",
        search_placeholder: "Поиск...",
        search_channels_placeholder: "Поиск каналов...",
        btn_prev: "Предыдущий",
        btn_next: "Следующий",
        schedule: "Расписание",
        modal_pl_title: "Добавить / изменить плейлист",
        label_name: "Название",
        pl_name_placeholder: "Мой плейлист",
        label_file: "Файл .m3u",
        label_url: "Или URL",
        label_add_epg: "Добавить EPG",
        label_epg_name: "Название EPG",
        epg_default_name: "EPG по умолчанию",
        label_epg_url: "URL EPG",
        label_epg_file: "Или файл EPG",
        epg_help: "Если не указано, будет использован URL по умолчанию или вы можете указать свой путь.",
        btn_save: "Сохранить",
        about_title: "О программе",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "бесплатный плеер для просмотра IPTV.",
        label_language: "Язык интерфейса / Language",
        why_created_title: "Почему я это создал?",
        why_created_text_1: "Все существующие приложения для просмотра IPTV либо устарели, либо требуют оплаты. Я решил создать свой плеер, который работает так, как мне нужно. Он не идеален, но выполняет свою задачу – и этим я доволен.",
        why_created_text_2: "Если есть такие же люди, как я – значит, эта идея была не зря. Приятного просмотра!",
        how_it_works_title: "Как это работает?",
        feature_flexibility: "Гибкость:",
        feature_flexibility_desc: "Добавляйте плейлисты по прямой ссылке или загружайте файлы .m3u напрямую.",
        feature_sorting: "Умная сортировка:",
        feature_sorting_desc: "Плеер автоматически распределяет каналы по категориям для удобного поиска.",
        feature_epg: "Программа передач (EPG):",
        feature_epg_desc: "Поддержка расписания, чтобы вы всегда знали, что идет сейчас и что будет дальше.",
        feature_caching: "Кэширование:",
        feature_caching_desc: "Для быстрой работы при повторном запуске основные данные сохраняются в памяти вашего устройства.",
        privacy_title: "Конфиденциальность",
        privacy_text: "Ваша приватность — мой приоритет. Все ваши данные хранятся исключительно локально в вашем браузере. У меня нет доступа к вашим ссылкам или контенту.",
        disclaimer_title: "Отказ от ответственности",
        disclaimer_text: "Приложение является исключительно техническим инструментом. Разработчик не предоставляет каналы и не несет ответственности за контент.",
        btn_tip: "Угостить чаем",
        toast_no_playlist: "Выберите плейлист",
        toast_pl_not_found: "Плейлист не найден",
        toast_load_error: "Ошибка загрузки данных",
        toast_cache_cleared: "Кэш очищен",
        toast_pl_saved: "Плейлист сохранён",
        toast_pl_updated: "Плейлист обновлён",
        toast_no_data: "нет данных",
        channels_not_found: "Каналы не найдены",
        now_playing: "Сейчас:",
        next_playing: "Далее:",
        no_epg_data: "Нет данных о передачах",
        favorites_cat: "Избранное",
        no_category: "Без категории",
        playlist_label: "Плейлист:",
        epg_programs_label: "Программы EPG:",
        epg_meta_label: "Иконки/метаданные EPG:",
        updating_data: "Обновление данных...",
        loading_channels: "Загрузка списка каналов...",
        loading_playlist_toast: "Загрузка плейлиста...",
        loading_epg_toast: "Загрузка EPG...",
        epg_loaded_toast: "EPG загружено для {n} каналов",
        delete_confirm: "Удалить плейлист?",
        source_url: "URL источник",
        source_local: "Локальный файл",
        epg_connected: "EPG подключён",
        no_epg: "Без EPG",
        active_badge: "Активный",
        toast_cors_error: "Ошибка CORS/Сети. Сервер блокирует запрос или нет интернета. Попробуйте скачать файл и загрузить его локально.",
        manage_empty_desc: "Нажмите «Добавить», чтобы загрузить M3U файл или указать URL.",
        btn_cast: "Трансляция",
        btn_fullscreen: "Во весь экран",
        btn_pip: "Картинка в картинке",
        recent_title: "Недавно смотрели",
        lan_modal_no_channel: "Сначала запустите канал",
        lan_copy_ok: "Ссылка скопирована",
        lan_copy_fail: "Не удалось скопировать ссылку"
      },
      en: {
        app_title: "IPTV Player Pro",
        manage_title: "Playlist Management",
        your_playlists: "Your IPTV Playlists",
        manage_desc: "Select an active list, manage sources, and quickly start watching.",
        btn_add: "Add",
        playlists: "Playlists",
        open_hint: "Click on a card to open",
        saved_playlists: "Playlists saved",
        available_epg: "EPG available",
        cache_status: "Cache Status",
        auto_load: "Auto-load on start",
        cache_data: "Cache playlist and EPG",
        enable_epg: "Enable EPG / Schedule",
        epg_desc: "If you don't need a schedule but want faster performance — turn this off.",
        btn_clear_cache: "Clear Cache",
        btn_go_categories: "Go to Categories",
        btn_back: "Back",
        search_placeholder: "Search...",
        search_channels_placeholder: "Search channels...",
        btn_prev: "Previous",
        btn_next: "Next",
        schedule: "Schedule",
        modal_pl_title: "Add / Edit Playlist",
        label_name: "Name",
        pl_name_placeholder: "My Playlist",
        label_file: "M3U File",
        label_url: "Or URL",
        label_add_epg: "Add EPG",
        label_epg_name: "EPG Name",
        epg_default_name: "Default EPG",
        label_epg_url: "EPG URL",
        label_epg_file: "Or EPG File",
        epg_help: "If not specified, the default URL or your own path will be used.",
        btn_save: "Save",
        about_title: "About",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "free player for watching IPTV.",
        label_language: "Interface Language",
        why_created_title: "Why did I create this?",
        why_created_text_1: "Most existing IPTV apps are either outdated or require payment. I decided to create my own player that works exactly how I need. It's not perfect, but it does its job – and I'm happy with that.",
        why_created_text_2: "If there are others like me, then this idea was worth it. Enjoy!",
        how_it_works_title: "How it works?",
        feature_flexibility: "Flexibility:",
        feature_flexibility_desc: "Add playlists via direct link or upload .m3u files directly.",
        feature_sorting: "Smart Sorting:",
        feature_sorting_desc: "The player automatically categorizes channels for easy searching.",
        feature_epg: "Program Guide (EPG):",
        feature_epg_desc: "Schedule support so you always know what's playing now and what's next.",
        feature_caching: "Caching:",
        feature_caching_desc: "For fast performance on repeat launches, main data is saved on your device.",
        privacy_title: "Privacy",
        privacy_text: "Your privacy is my priority. All your data is stored exclusively locally in your browser. I have no access to your links or content.",
        disclaimer_title: "Disclaimer",
        disclaimer_text: "This app is strictly a technical tool. The developer does not provide channels and is not responsible for content.",
        btn_tip: "Buy me a tea",
        toast_no_playlist: "Select a playlist",
        toast_pl_not_found: "Playlist not found",
        toast_load_error: "Data load error",
        toast_cache_cleared: "Cache cleared",
        toast_pl_saved: "Playlist saved",
        toast_pl_updated: "Playlist updated",
        toast_no_data: "no data",
        channels_not_found: "No channels found",
        now_playing: "Now:",
        next_playing: "Next:",
        no_epg_data: "No schedule data",
        favorites_cat: "Favorites",
        no_category: "Uncategorized",
        playlist_label: "Playlist:",
        epg_programs_label: "EPG Programs:",
        epg_meta_label: "EPG Icons/Meta:",
        updating_data: "Updating data...",
        loading_channels: "Loading channel list...",
        loading_playlist_toast: "Loading playlist...",
        loading_epg_toast: "Loading EPG...",
        epg_loaded_toast: "EPG loaded for {n} channels",
        delete_confirm: "Delete playlist?",
        source_url: "URL source",
        source_local: "Local file",
        epg_connected: "EPG connected",
        no_epg: "No EPG",
        active_badge: "Active",
        toast_cors_error: "CORS/Network error. The server might be blocking the request or you are offline. Try downloading the file and loading it locally.",
        manage_empty_desc: "Click 'Add' to upload an M3U file or provide a URL.",
        btn_cast: "Cast",
        btn_fullscreen: "Fullscreen",
        btn_pip: "PiP",
        recent_title: "Recently Watched"
      },
      ua: {
        app_title: "IPTV Player Pro",
        manage_title: "Керування плейлистами",
        your_playlists: "Ваші плейлисти IPTV",
        manage_desc: "Оберіть активний список, керуйте джерелами та швидко переходьте до перегляду.",
        btn_add: "Додати",
        playlists: "Плейлисти",
        open_hint: "Натисніть на картку для відкриття",
        saved_playlists: "Збережено плейлистів",
        available_epg: "Доступно EPG",
        cache_status: "Стан кешу",
        auto_load: "Автозавантаження при старті",
        cache_data: "Кешувати плейлист та EPG",
        enable_epg: "Увімкнути EPG / розклад",
        epg_desc: "Якщо вам не потрібен розклад, але потрібна швидка робота — вимкніть це.",
        btn_clear_cache: "Очистити кеш",
        btn_go_categories: "Перейти до категорій",
        btn_back: "Назад",
        search_placeholder: "Пошук...",
        search_channels_placeholder: "Пошук каналів...",
        btn_prev: "Попередній",
        btn_next: "Наступний",
        schedule: "Розклад",
        modal_pl_title: "Додати / змінити плейлист",
        label_name: "Назва",
        pl_name_placeholder: "Мій плейлист",
        label_file: "Файл .m3u",
        label_url: "Або URL",
        label_add_epg: "Додати EPG",
        label_epg_name: "Назва EPG",
        epg_default_name: "EPG за замовчуванням",
        label_epg_url: "URL EPG",
        label_epg_file: "Або файл EPG",
        epg_help: "Якщо не вказано, буде використано URL за замовчуванням або ви можете вказати свій шлях.",
        btn_save: "Зберегти",
        about_title: "Про програму",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "безкоштовний плеєр для перегляду IPTV.",
        label_language: "Мова інтерфейсу",
        why_created_title: "Чому я це створив?",
        why_created_text_1: "Всі існуючі програми для перегляду IPTV або застаріли, або потребують оплати. Я вирішив створити свій плеєр, який працює так, як мені потрібно.",
        why_created_text_2: "Якщо є такі ж люди, як я — значить, ця ідея була не дарма. Приємного перегляду!",
        how_it_works_title: "Як це працює?",
        feature_flexibility: "Гнучкість:",
        feature_flexibility_desc: "Додавайте плейлисти за прямим посиланням або завантажуйте файли .m3u.",
        feature_sorting: "Розумне сортування:",
        feature_sorting_desc: "Плеєр автоматично розподіляє канали за категоріями.",
        feature_epg: "Програма передач (EPG):",
        feature_epg_desc: "Підтримка розкладу, щоб ви завжди знали, що йде зараз і що буде далі.",
        feature_caching: "Кешування:",
        feature_caching_desc: "Для швидкої роботи основні дані зберігаються в пам'яті вашого пристрою.",
        privacy_title: "Конфіденційність",
        privacy_text: "Ваша приватність — мій пріоритет. Всі дані зберігаються локально.",
        disclaimer_title: "Відмова від відповідальності",
        disclaimer_text: "Програма є технічним інструментом. Розробник не надає канали.",
        btn_tip: "Пригостити чаєм",
        toast_no_playlist: "Оберіть плейлист",
        toast_pl_not_found: "Плейлист не знайдено",
        toast_load_error: "Помилка завантаження даних",
        toast_cache_cleared: "Кеш очищено",
        toast_pl_saved: "Плейлист збережено",
        toast_pl_updated: "Плейлист оновлено",
        toast_no_data: "немає даних",
        channels_not_found: "Канали не знайдено",
        now_playing: "Зараз:",
        next_playing: "Далі:",
        no_epg_data: "Немає даних про передачі",
        favorites_cat: "Обране",
        no_category: "Без категорії",
        playlist_label: "Плейлист:",
        epg_programs_label: "Програми EPG:",
        epg_meta_label: "Іконки/метадані EPG:",
        updating_data: "Оновлення даних...",
        loading_channels: "Завантаження списку каналів...",
        loading_playlist_toast: "Завантаження плейлиста...",
        loading_epg_toast: "Завантаження EPG...",
        epg_loaded_toast: "EPG завантажено для {n} каналів",
        delete_confirm: "Видалити плейлист?",
        source_url: "Джерело URL",
        source_local: "Локальний файл",
        epg_connected: "EPG підключений",
        no_epg: "Без EPG",
        active_badge: "Активний",
        toast_cors_error: "Помилка CORS/Мережі. Сервер блокує запит або немає інтернету. Спробуйте завантажити файл і додати його локально.",
        manage_empty_desc: "Натисніть «Додати», щоб завантажити M3U файл або вказати URL.",
        btn_cast: "Трансляція"
      },
      kz: {
        app_title: "IPTV Player Pro",
        manage_title: "Плейлистерді басқару",
        your_playlists: "Сіздің IPTV плейлистеріңіз",
        manage_desc: "Белсенді тізімді таңдаңыз, дереккөздерді басқарыңыз және көруге тез өтіңіз.",
        btn_add: "Қосу",
        playlists: "Плейлистер",
        open_hint: "Ашу үшін картаны басыңыз",
        saved_playlists: "Сақталған плейлистер",
        available_epg: "Қолжетімді EPG",
        cache_status: "Кэш күйі",
        auto_load: "Іске қосу кезінде автожүктеу",
        cache_data: "Плейлист пен EPG кэштеу",
        enable_epg: "EPG / кестені қосу",
        epg_desc: "Егер сізге кесте қажет болмаса, бірақ тез жұмыс істеу керек болса - бұны өшіріңіз.",
        btn_clear_cache: "Кэшті тазалау",
        btn_go_categories: "Санаттарға өту",
        btn_back: "Артқа",
        search_placeholder: "Іздеу...",
        search_channels_placeholder: "Арналарды іздеу...",
        btn_prev: "Алдыңғы",
        btn_next: "Келесі",
        schedule: "Кесте",
        modal_pl_title: "Плейлист қосу / өзгерту",
        label_name: "Атауы",
        pl_name_placeholder: "Менің плейлистім",
        label_file: ".m3u файлы",
        label_url: "Немесе URL",
        label_add_epg: "EPG қосу",
        label_epg_name: "EPG атауы",
        epg_default_name: "Әдепкі EPG",
        label_epg_url: "EPG URL",
        label_epg_file: "Немесе EPG файлы",
        epg_help: "Көрсетілмесе, әдепкі URL пайдаланылады немесе өз жолыңызды көрсетуге болады.",
        btn_save: "Сақтау",
        about_title: "Бағдарлама туралы",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "IPTV көруге арналған тегін плеер.",
        label_language: "Интерфейс тілі",
        why_created_title: "Неге мен бұны жасадым?",
        why_created_text_1: "Барлық қолданыстағы IPTV қосымшалары не ескірген, не төлемді талап етеді. Мен өзіме қалай қажет болса, солай жұмыс істейтін өз плеерімді жасауды шештім.",
        why_created_text_2: "Егер мен сияқты адамдар болса — демек, бұл идея бекер емес. Көру жақсы болсын!",
        how_it_works_title: "Бұл қалай жұмыс істейді?",
        feature_flexibility: "Икемділік:",
        feature_flexibility_desc: "Плейлистерді тікелей сілтеме арқылы қосыңыз немесе .m3u файлдарын жүктеңіз.",
        feature_sorting: "Ақылды сұрыптау:",
        feature_sorting_desc: "Плеер арналарды іздеуге ыңғайлы болу үшін санаттарға автоматты түрде бөледі.",
        feature_epg: "Бағдарламалар кестесі (EPG):",
        feature_epg_desc: "Қазір не болып жатқанын және келесіде не болатынын әрқашан білу үшін кесте қолдауы.",
        feature_caching: "Кэштеу:",
        feature_caching_desc: "Қайта іске қосқан кезде тез жұмыс істеу үшін негізгі деректер құрылғыңызда сақталады.",
        privacy_title: "Құпиялылық",
        privacy_text: "Сіздің құпиялылығыңыз — менің басымдығым. Барлық деректеріңіз тек браузеріңізде локальді сақталады.",
        disclaimer_title: "Жауапкершіліктен бас тарту",
        disclaimer_text: "Қосымша тек техникалық құрал болып табылады. Әзірлеуші арналарды ұсынбайды.",
        btn_tip: "Шаймен сыйлау",
        toast_no_playlist: "Плейлистті таңдаңыз",
        toast_pl_not_found: "Плейлист табылмады",
        toast_load_error: "Деректерді жүктеу қатесі",
        toast_cache_cleared: "Кэш тазаланды",
        toast_pl_saved: "Плейлист сақталды",
        toast_pl_updated: "Плейлист жаңартылды",
        toast_no_data: "деректер жоқ",
        channels_not_found: "Арналар табылмады",
        now_playing: "Қазір:",
        next_playing: "Келесі:",
        no_epg_data: "Бағдарламалар туралы деректер жоқ",
        favorites_cat: "Таңдаулы",
        no_category: "Санатсыз",
        playlist_label: "Плейлист:",
        epg_programs_label: "EPG бағдарламалары:",
        epg_meta_label: "EPG белгішелері/метадеректері:",
        updating_data: "Деректерді жаңарту...",
        loading_channels: "Арналар тізімін жүктеу...",
        loading_playlist_toast: "Плейлистті жүктеу...",
        loading_epg_toast: "EPG жүктеу...",
        epg_loaded_toast: "{n} арна үшін EPG жүктелді",
        delete_confirm: "Плейлистті өшіру керек пе?",
        source_url: "URL дереккөзі",
        source_local: "Локальді файл",
        epg_connected: "EPG қосылған",
        no_epg: "EPG-сіз",
        active_badge: "Белсенді",
        toast_cors_error: "CORS/Желі қатесі. Сервер сұранысты блоктап тұр немесе интернет жоқ. Файлды жүктеп алып, оны локальді түрде қосып көріңіз.",
        manage_empty_desc: "M3U файлын жүктеу немесе URL көрсету үшін «Қосу» түймесін басыңыз.",
        btn_cast: "Трансляция"
      },
      de: {
        app_title: "IPTV Player Pro",
        manage_title: "Playlisten verwalten",
        your_playlists: "Ihre IPTV-Playlisten",
        manage_desc: "Wählen Sie eine aktive Liste aus, verwalten Sie Quellen und schauen Sie sofort fern.",
        btn_add: "Hinzufügen",
        playlists: "Playlisten",
        open_hint: "Klicken Sie auf eine Karte zum Öffnen",
        saved_playlists: "Gespeicherte Playlisten",
        available_epg: "EPG verfügbar",
        cache_status: "Cache-Status",
        auto_load: "Auto-Start",
        cache_data: "Playlist und EPG zwischenspeichern",
        enable_epg: "EPG / Programm aktivieren",
        epg_desc: "Deaktivieren Sie dies für schnellere Leistung, wenn Sie kein Programm benötigen.",
        btn_clear_cache: "Cache leeren",
        btn_go_categories: "Zu den Kategorien",
        btn_back: "Zurück",
        search_placeholder: "Suchen...",
        search_channels_placeholder: "Kanäle suchen...",
        btn_prev: "Vorheriger",
        btn_next: "Nächster",
        schedule: "Programm",
        modal_pl_title: "Playlist hinzufügen / bearbeiten",
        label_name: "Name",
        pl_name_placeholder: "Meine Playlist",
        label_file: "M3U-Datei",
        label_url: "Oder URL",
        label_add_epg: "EPG hinzufügen",
        label_epg_name: "EPG-Name",
        epg_default_name: "Standard-EPG",
        label_epg_url: "EPG-URL",
        label_epg_file: "Oder EPG-Datei",
        epg_help: "Falls nicht angegeben, wird die Standard-URL verwendet.",
        btn_save: "Speichern",
        about_title: "Über",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "kostenloser Player für IPTV.",
        label_language: "Sprache",
        why_created_title: "Warum habe ich das erstellt?",
        why_created_text_1: "Die meisten IPTV-Apps sind entweder veraltet oder kostenpflichtig. Ich wollte einen Player, der so funktioniert, wie ich es brauche.",
        how_it_works_title: "Wie funktioniert es?",
        feature_flexibility: "Flexibilität:",
        feature_flexibility_desc: "Fügen Sie Playlisten per Link hinzu oder laden Sie Dateien hoch.",
        feature_sorting: "Intelligente Sortierung:",
        feature_sorting_desc: "Der Player sortiert Kanäle automatisch in Kategorien.",
        feature_epg: "Programmzeitschrift (EPG):",
        feature_epg_desc: "Unterstützung für Sendepläne.",
        feature_caching: "Caching:",
        feature_caching_desc: "Daten werden für schnellen Start lokal gespeichert.",
        privacy_title: "Datenschutz",
        privacy_text: "Ihre Privatsphäre ist Priorität. Alle Daten werden nur lokal gespeichert.",
        disclaimer_title: "Haftungsausschluss",
        disclaimer_text: "Die App ist nur ein Werkzeug. Der Entwickler bietet keine Kanäle an.",
        btn_tip: "Tee spendieren",
        toast_no_playlist: "Wählen Sie eine Playlist",
        toast_pl_not_found: "Playlist nicht gefunden",
        toast_load_error: "Fehler beim Laden",
        toast_cache_cleared: "Cache geleert",
        toast_pl_saved: "Playlist gespeichert",
        toast_pl_updated: "Playlist aktualisiert",
        toast_no_data: "keine Daten",
        channels_not_found: "Keine Kanäle gefunden",
        now_playing: "Jetzt:",
        next_playing: "Als nächstes:",
        no_epg_data: "Keine Programmdaten",
        favorites_cat: "Favoriten",
        no_category: "Ohne Kategorie",
        playlist_label: "Playlist:",
        epg_programs_label: "EPG-Programme:",
        epg_meta_label: "EPG-Icons/Meta:",
        updating_data: "Daten werden aktualisiert...",
        loading_channels: "Kanalliste wird geladen...",
        loading_playlist_toast: "Playlist wird geladen...",
        loading_epg_toast: "EPG wird geladen...",
        epg_loaded_toast: "EPG für {n} Kanäle geladen",
        delete_confirm: "Playlist löschen?",
        source_url: "URL-Quelle",
        source_local: "Lokale Datei",
        epg_connected: "EPG verbunden",
        no_epg: "Kein EPG",
        active_badge: "Aktiv",
        toast_cors_error: "CORS/Netzwerkfehler. Der Server blockiert die Anfrage oder es besteht keine Internetverbindung. Versuchen Sie, die Datei manuell hochzuladen.",
        manage_empty_desc: "Klicken Sie auf 'Hinzufügen', um eine M3U-Datei hochzuladen oder eine URL anzugeben.",
        btn_cast: "Übertragen"
      },
      es: {
        app_title: "IPTV Player Pro",
        manage_title: "Gestión de Listas",
        your_playlists: "Tus Listas IPTV",
        manage_desc: "Selecciona una lista activa, gestiona fuentes y comienza a ver rápidamente.",
        btn_add: "Añadir",
        playlists: "Listas",
        open_hint: "Haz clic en una tarjeta para abrir",
        saved_playlists: "Listas guardadas",
        available_epg: "EPG disponible",
        cache_status: "Estado del Cache",
        auto_load: "Auto-carga al inicio",
        cache_data: "Cachear lista y EPG",
        enable_epg: "Activar EPG / Horario",
        epg_desc: "Desactiva esto para mayor velocidad si no necesitas horario.",
        btn_clear_cache: "Limpiar Cache",
        btn_go_categories: "Ir a Categorías",
        btn_back: "Atrás",
        search_placeholder: "Buscar...",
        search_channels_placeholder: "Buscar canales...",
        btn_prev: "Anterior",
        btn_next: "Siguiente",
        schedule: "Horario",
        modal_pl_title: "Añadir / Editar Lista",
        label_name: "Nombre",
        pl_name_placeholder: "Mi Lista",
        label_file: "Archivo M3U",
        label_url: "O URL",
        label_add_epg: "Añadir EPG",
        label_epg_name: "Nombre EPG",
        epg_default_name: "EPG por defecto",
        label_epg_url: "URL EPG",
        label_epg_file: "O Archivo EPG",
        btn_save: "Guardar",
        about_title: "Acerca de",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "reproductor gratuito para ver IPTV.",
        label_language: "Idioma",
        why_created_title: "¿Por qué creé esto?",
        how_it_works_title: "¿Cómo funciona?",
        feature_flexibility: "Flexibilidad:",
        feature_flexibility_desc: "Añade listas vía enlace o sube archivos.",
        feature_sorting: "Clasificación Inteligente:",
        feature_sorting_desc: "El reproductor organiza canales automáticamente.",
        feature_epg: "Guía de Programación (EPG):",
        feature_epg_desc: "Soporte de horarios.",
        feature_caching: "Caché:",
        feature_caching_desc: "Datos guardados localmente para rapidez.",
        privacy_title: "Privacidad",
        privacy_text: "Tu privacidad es prioridad. Datos guardados solo localmente.",
        disclaimer_title: "Descargo de Responsabilidad",
        disclaimer_text: "La app es solo una herramienta. El desarrollador no ofrece canales.",
        btn_tip: "Invitar a un té",
        toast_no_playlist: "Selecciona una lista",
        toast_pl_not_found: "Lista no encontrada",
        toast_load_error: "Error de carga",
        toast_cache_cleared: "Caché limpio",
        toast_pl_saved: "Lista guardada",
        toast_pl_updated: "Lista actualizada",
        toast_no_data: "sin datos",
        channels_not_found: "No se encontraron canales",
        now_playing: "Ahora:",
        next_playing: "Siguiente:",
        no_epg_data: "Sin datos de programación",
        favorites_cat: "Favoritos",
        no_category: "Sin categoría",
        playlist_label: "Lista:",
        epg_programs_label: "Programas EPG:",
        epg_meta_label: "Iconos/Meta EPG:",
        updating_data: "Actualizando datos...",
        loading_channels: "Cargando lista de canales...",
        loading_playlist_toast: "Cargando lista...",
        loading_epg_toast: "Cargando EPG...",
        epg_loaded_toast: "EPG cargado para {n} canales",
        delete_confirm: "¿Eliminar lista?",
        source_url: "Fuente URL",
        source_local: "Archivo local",
        epg_connected: "EPG conectado",
        no_epg: "Sin EPG",
        active_badge: "Activa",
        toast_cors_error: "Error de CORS/Red. El servidor bloquea la solicitud o no hay internet. Intenta descargar el archivo y cargarlo localmente.",
        manage_empty_desc: "Haz clic en 'Añadir' para subir un archivo M3U o indicar una URL.",
        btn_cast: "Transmitir"
      },
      fr: {
        app_title: "IPTV Player Pro",
        manage_title: "Gestion des Listes",
        your_playlists: "Vos Listes IPTV",
        manage_desc: "Sélectionnez une liste, gérez les sources et regardez rapidement.",
        btn_add: "Ajouter",
        playlists: "Listes",
        open_hint: "Cliquez sur une carte pour ouvrir",
        saved_playlists: "Listes enregistrées",
        available_epg: "EPG disponible",
        cache_status: "État du Cache",
        auto_load: "Auto-chargement",
        cache_data: "Mettre en cache la liste et l'EPG",
        enable_epg: "Activer EPG / Programme",
        epg_desc: "Désactivez pour plus de rapidité si vous n'avez pas besoin du programme.",
        btn_clear_cache: "Vider le cache",
        btn_go_categories: "Aller aux catégories",
        btn_back: "Retour",
        search_placeholder: "Rechercher...",
        search_channels_placeholder: "Rechercher des chaînes...",
        btn_prev: "Précédent",
        btn_next: "Suivant",
        schedule: "Programme",
        modal_pl_title: "Ajouter / Modifier la liste",
        label_name: "Nom",
        pl_name_placeholder: "Ma Liste",
        label_file: "Fichier M3U",
        label_url: "Ou URL",
        label_add_epg: "Ajouter EPG",
        label_epg_name: "Nom EPG",
        epg_default_name: "EPG par défaut",
        btn_save: "Enregistrer",
        about_title: "À propos",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "lecteur gratuit pour IPTV.",
        label_language: "Langue",
        why_created_title: "Pourquoi ai-je créé ceci ?",
        how_it_works_title: "Comment ça marche ?",
        feature_flexibility: "Flexibilité :",
        feature_flexibility_desc: "Ajoutez des listes via lien ou téléchargez des fichiers.",
        feature_sorting: "Tri Intelligent :",
        feature_sorting_desc: "Le lecteur organise les chaînes automatiquement.",
        feature_epg: "Guide des Programmes (EPG) :",
        feature_epg_desc: "Support des horaires.",
        feature_caching: "Mise en cache :",
        feature_caching_desc: "Données locales pour la rapidité.",
        privacy_title: "Confidentialité",
        privacy_text: "Votre vie privée est la priorité. Données locales uniquement.",
        disclaimer_title: "Clause de non-responsabilité",
        disclaimer_text: "L'application est un outil technique. Le développeur ne fournit pas de chaînes.",
        btn_tip: "Offrir un thé",
        toast_no_playlist: "Sélectionnez une liste",
        toast_pl_not_found: "Liste non trouvée",
        toast_load_error: "Erreur de chargement",
        toast_cache_cleared: "Cache vidé",
        toast_pl_saved: "Liste enregistrée",
        toast_pl_updated: "Liste mise à jour",
        toast_no_data: "pas de données",
        channels_not_found: "Aucune chaîne trouvée",
        now_playing: "En ce moment :",
        next_playing: "Suivant :",
        no_epg_data: "Pas de programme",
        favorites_cat: "Favoris",
        no_category: "Sans catégorie",
        playlist_label: "Liste :",
        epg_programs_label: "Programmes EPG :",
        epg_meta_label: "Icones/Méta EPG :",
        updating_data: "Mise à jour...",
        loading_channels: "Chargement des chaînes...",
        loading_playlist_toast: "Chargement de la liste...",
        loading_epg_toast: "Chargement de l'EPG...",
        epg_loaded_toast: "EPG chargé pour {n} chaînes",
        delete_confirm: "Supprimer la liste ?",
        source_url: "Source URL",
        source_local: "Fichier local",
        epg_connected: "EPG connecté",
        no_epg: "Sans EPG",
        active_badge: "Active",
        toast_cors_error: "Erreur CORS/Réseau. Le serveur bloque la requête ou pas d'internet. Essayez de télécharger le fichier et de le charger localement.",
        manage_empty_desc: "Cliquez sur « Ajouter » pour charger un fichier M3U ou indiquer une URL.",
        btn_cast: "Diffuser"
      },
      by: {
        app_title: "IPTV Player Pro",
        manage_title: "Кіраванне плэйлістамі",
        your_playlists: "Вашы плейлісты IPTV",
        manage_desc: "Абярыце актыўны спіс, кіруйце крыніцамі і хутка пераходзьце да прагляду.",
        btn_add: "Дадаць",
        playlists: "Плэйлісты",
        open_hint: "Націсніце на картку для адкрыцця",
        saved_playlists: "Захавана плэйлістаў",
        available_epg: "Даступна EPG",
        cache_status: "Стан кэшу",
        auto_load: "Аўтазагрузка пры старце",
        cache_data: "Кэшаваць плэйліст і EPG",
        enable_epg: "Уключыць EPG / расклад",
        epg_desc: "Калі вам не патрэбны расклад, але патрэбна хуткая праца — выключыце гэта.",
        btn_clear_cache: "Ачысціць кэш",
        btn_go_categories: "Перайсці да катэгорый",
        btn_back: "Назад",
        search_placeholder: "Пошук...",
        search_channels_placeholder: "Пошук каналаў...",
        btn_prev: "Папярэдні",
        btn_next: "Наступны",
        schedule: "Расклад",
        modal_pl_title: "Дадаць / змяніць плэйліст",
        label_name: "Назва",
        pl_name_placeholder: "Мой плэйліст",
        label_file: "Файл .m3u",
        label_url: "Або URL",
        label_add_epg: "Дадаць EPG",
        label_epg_name: "Назва EPG",
        epg_default_name: "EPG па змаўчанні",
        label_epg_url: "URL EPG",
        label_epg_file: "Або файл EPG",
        btn_save: "Захаваць",
        about_title: "Пра праграму",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "бясплатны плеер для прагляду IPTV.",
        label_language: "Мова інтэрфейсу",
        why_created_title: "Чаму я гэта стварыў?",
        why_created_text_1: "Усе існуючыя праграмы для прагляду IPTV альбо састарэлі, альбо патрабуюць аплаты. Я вырашыў стварыць свой плеер, які працуе так, як мне трэба.",
        how_it_works_title: "Як гэта працуе?",
        feature_flexibility: "Гнуткасць:",
        feature_flexibility_desc: "Дадайце плэйлісты па прамой спасылцы або загружайце файлы .m3u.",
        feature_sorting: "Разумная сартаванне:",
        feature_sorting_desc: "Плеер аўтаматычна размяркоўвае каналы па катэгорыях.",
        feature_epg: "Праграма перадач (EPG):",
        feature_epg_desc: "Падтрымка раскладу.",
        feature_caching: "Кэшаванне:",
        feature_caching_desc: "Для хуткай працы асноўныя дадзеныя захоўваюцца ў памяці вашай прылады.",
        privacy_title: "Канфідэнцыяльнасць",
        privacy_text: "Ваша прыватнасць — мой прыярытэт. Усе дадзеныя захоўваюцца лакальна.",
        disclaimer_title: "Адмова ад адказнасці",
        disclaimer_text: "Праграма з'яўляецца тэхнічным інструментам. Распрацоўшчык не дае каналы.",
        btn_tip: "Пачаставаць гарбатай",
        toast_no_playlist: "Абярыце плэйліст",
        toast_pl_not_found: "Плэйліст не знойдзены",
        toast_load_error: "Памылка загрузкі дадзеных",
        toast_cache_cleared: "Кэш ачышчаны",
        toast_pl_saved: "Плэйліст захаваны",
        toast_pl_updated: "Плэйліст абноўлены",
        toast_no_data: "няма дадзеных",
        channels_not_found: "Каналы не знойдзены",
        now_playing: "Зараз:",
        next_playing: "Далей:",
        no_epg_data: "Няма дадзеных аб перадачах",
        favorites_cat: "Абранае",
        no_category: "Без катэгорыі",
        playlist_label: "Плэйліст:",
        epg_programs_label: "Праграмы EPG:",
        epg_meta_label: "Іконкі/метаданыя EPG:",
        updating_data: "Абнаўленне дадзеных...",
        loading_channels: "Загрузка спісу каналаў...",
        loading_playlist_toast: "Загрузка плэйліста...",
        loading_epg_toast: "Загрузка EPG...",
        epg_loaded_toast: "EPG загружана для {n} каналаў",
        delete_confirm: "Выдаліць плэйліст?",
        source_url: "Крыніца URL",
        source_local: "Лакальны файл",
        epg_connected: "EPG падключаны",
        no_epg: "Без EPG",
        active_badge: "Актыўны",
        toast_cors_error: "Памылка CORS/Сеткі. Сервер блакуе запыт або няма інтэрнэту. Паспрабуйце спампаваць файл і загрузіць яго лакальна.",
        manage_empty_desc: "Націсніце «Дадаць», каб загрузіць M3U файл або пазначыць URL.",
        btn_cast: "Трансляцыя"
      },
      zh: {
        app_title: "IPTV Player Pro",
        manage_title: "播放列表管理",
        your_playlists: "您的 IPTV 播放列表",
        manage_desc: "选择活动列表、管理源并快速开始观看。",
        btn_add: "添加",
        playlists: "播放列表",
        open_hint: "点击卡片打开",
        saved_playlists: "已保存的播放列表",
        available_epg: "可用 EPG",
        cache_status: "缓存状态",
        auto_load: "启动时自动加载",
        cache_data: "缓存播放列表和 EPG",
        enable_epg: "启用 EPG / 节目表",
        epg_desc: "如果您不需要节目表但想要更快的速度，请关闭此项。",
        btn_clear_cache: "清除缓存",
        btn_go_categories: "前往分类",
        btn_back: "返回",
        search_placeholder: "搜索...",
        search_channels_placeholder: "搜索频道...",
        btn_prev: "上一个",
        btn_next: "下一个",
        schedule: "节目表",
        modal_pl_title: "添加 / 编辑播放列表",
        label_name: "名称",
        pl_name_placeholder: "我的播放列表",
        label_file: "M3U 文件",
        label_url: "或 URL",
        label_add_epg: "添加 EPG",
        label_epg_name: "EPG 名称",
        epg_default_name: "默认 EPG",
        label_epg_url: "EPG URL",
        label_epg_file: "或 EPG 文件",
        btn_save: "保存",
        about_title: "关于",
        app_name_full: "IPTV Player Pro",
        app_desc_short: "用于观看 IPTV 的免费播放器。",
        label_language: "界面语言",
        why_created_title: "我为什么要创建这个？",
        why_created_text_1: "大多数现有的 IPTV 应用程序要么过时，要么需要付费。我决定创建自己的播放器，完全按我的需求工作。它并不完美，但它完成了它的工作——我很满意。",
        how_it_works_title: "它是如何工作的？",
        feature_flexibility: "灵活性：",
        feature_flexibility_desc: "通过直接链接添加播放列表或直接上传 .m3u 文件。",
        feature_sorting: "智能排序：",
        feature_sorting_desc: "播放器自动对频道进行分类，以便于搜索。",
        feature_epg: "节目指南 (EPG)：",
        feature_epg_desc: "节目表支持，让您始终了解正在播出的内容和接下来的内容。",
        feature_caching: "缓存：",
        feature_caching_desc: "对于重复启动时的快速性能，主要数据保存在您的设备上。",
        privacy_title: "隐私",
        privacy_text: "您的隐私是我的首要任务。您的所有数据都仅本地存储在浏览器中。我无法访问您的链接或内容。",
        disclaimer_title: "免责声明",
        disclaimer_text: "此应用程序严格来说是一个技术工具。开发商不提供频道，也不对内容负责。",
        btn_tip: "请作者喝茶",
        toast_no_playlist: "选择播放列表",
        toast_pl_not_found: "找不到播放列表",
        toast_load_error: "数据加载错误",
        toast_cache_cleared: "缓存已清除",
        toast_pl_saved: "播放列表已保存",
        toast_pl_updated: "播放列表已更新",
        toast_no_data: "无数据",
        channels_not_found: "找不到频道",
        now_playing: "正在播放：",
        next_playing: "稍后播放：",
        no_epg_data: "无节目表数据",
        favorites_cat: "收藏",
        no_category: "未分类",
        playlist_label: "播放列表：",
        epg_programs_label: "EPG 节目：",
        epg_meta_label: "EPG 图标/元数据：",
        updating_data: "正在更新数据...",
        loading_channels: "正在加载频道列表...",
        loading_playlist_toast: "正在加载播放列表...",
        loading_epg_toast: "正在加载 EPG...",
        epg_loaded_toast: "已加载 {n} 个频道的 EPG",
        delete_confirm: "删除播放列表？",
        source_url: "URL 来源",
        source_local: "本地文件",
        epg_connected: "EPG 已连接",
        no_epg: "无 EPG",
        active_badge: "活动",
        toast_cors_error: "CORS/网络错误。服务器可能阻止了请求，或者您处于离线状态。请尝试下载文件并本地加载。",
        manage_empty_desc: "点击“添加”上传 M3U 文件或提供 URL。",
        btn_cast: "投屏"
      }
    };
    this.init();
    this.epgTimer = null;
  }

  getDefaultEpgUrl() {
    return "https://raw.githubusercontent.com/Lorax121/everyday_epg_update/main/data/epg.xml.gz";
  }

  ensureDefaultEpgForPlaylist(playlist) {
    if (!this.enableEpg) return null;
    if (!playlist || playlist.epgId) return null;

    const defaultUrl = this.getDefaultEpgUrl();
    let epg = this.epgs.find((e) => e.url === defaultUrl);
    if (!epg) {
      epg = {
        id: Date.now().toString() + "-epg-default",
        name: "EPG по умолчанию",
        url: defaultUrl,
      };
      this.epgs.push(epg);
      localStorage.setItem("epgs", JSON.stringify(this.epgs));
    }

    playlist.epgId = epg.id;
    this.selectedEpgId = epg.id;
    localStorage.setItem("selectedEpgId", epg.id);
    localStorage.setItem("playlists", JSON.stringify(this.playlists));
    return epg;
  }

  async init() {
    this.applyDeviceProfile();
    this.applyTranslations();
    this.db = await idb.openDB("iptv", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("files", { keyPath: "id" });
        }
        if (oldVersion < 2) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
      },
    });

    this.bindEvents();
    this.bindDeviceModeControls();
    this.initRemoteNavigation();
    if (window.isCastApiAvailable) {
      this.initCast();
    }
    this.renderMiniLoading();
    this.renderManage();
    await this.updateCacheInfo();

    if (this.autoLoad && this.selectedPlaylistId) {
      this.showLoader(true);
      try {
        const pl = this.playlists.find(
          (p) => p.id === this.selectedPlaylistId
        );
        this.ensureDefaultEpgForPlaylist(pl);
        if (!pl) {
          this.toast(this.t("toast_pl_not_found"), "danger");
          return;
        }

        await this.loadPlaylist(pl, true);
        await this.ensureEpgLoaded(pl);
        this.switchPage("categories");
      } catch (e) {
        console.error("Auto load error:", e);
        this.toast(this.t("toast_load_error"), "danger");
      } finally {
        this.showLoader(false);
      }
    }
  }

  debounce(fn, delay = 150) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }


  /* =========  Caching  ========= */
  async getCachedData(key, maxAgeMs = this.playlistCacheAgeMs) {
    if (!this.cacheData) return null;
    try {
      const cached = await this.db.get("cache", key);
      if (cached && cached.data) {
        if (Date.now() - cached.timestamp < maxAgeMs) {
          return cached.data;
        }
      }
    } catch (e) {
      console.warn("Error reading cache:", e);
    }
    return null;
  }

  async setCachedData(key, data) {
    if (!this.cacheData) return;
    try {
      await this.db.put("cache", {
        key: key,
        data: data,
        timestamp: Date.now()
      });
      console.log("Saved to cache:", key);
    } catch (e) {
      console.warn("Error saving to cache:", e);
    }
  }

  async getCacheTimestamp(key) {
    if (!this.cacheData) return null;
    try {
      const cached = await this.db.get("cache", key);
      return cached?.timestamp || null;
    } catch (e) {
      return null;
    }
  }

  formatCacheTime(ts) {
    if (!ts) return this.t("toast_no_data");
    const localeMap = {
      ru: "ru-RU", en: "en-US", ua: "uk-UA", kz: "kk-KZ", de: "de-DE", es: "es-ES", fr: "fr-FR", by: "be-BY", zh: "zh-CN"
    };
    const locale = localeMap[this.lang] || "en-US";
    return new Date(ts).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  setLoadingState(type, isLoading, text = "") {
    this.loadingState[type] = isLoading;
    const visible = Object.values(this.loadingState).some(Boolean);
    const el = $("#manage-loading-indicator");
    if (visible) {
      el.find("span:last").text(text || this.t("updating_data"));
      el.show();
    } else {
      el.hide();
    }
    if ($("#page-player").hasClass("active")) {
      $("#mini-epg-loading").toggle(this.loadingState.epg);
    }
  }

  async updateCacheInfo() {
    const playlistId = this.selectedPlaylistId;
    const playlistKey = playlistId ? this.getCacheKey("playlist_parsed", playlistId) : null;
    const ep = this.getSelectedEpg(this.playlists.find((p) => p.id === playlistId));
    const epgScheduleKey = ep ? this.getCacheKey("epg_schedule", ep.id) : null;
    const epgMetaKey = ep ? this.getCacheKey("epg_meta", ep.id) : null;

    const [playlistTs, epgScheduleTs, epgMetaTs] = await Promise.all([
      playlistKey ? this.getCacheTimestamp(playlistKey) : null,
      epgScheduleKey ? this.getCacheTimestamp(epgScheduleKey) : null,
      epgMetaKey ? this.getCacheTimestamp(epgMetaKey) : null,
    ]);

    $("#cache-playlist-time").text(this.t("playlist_label") + " " + this.formatCacheTime(playlistTs));
    $("#cache-epg-time").text(this.t("epg_programs_label") + " " + this.formatCacheTime(epgScheduleTs));
    $("#cache-icons-time").text(this.t("epg_meta_label") + " " + this.formatCacheTime(epgMetaTs));
  }

  t(key, params = {}) {
    let text = this.translations[this.lang]?.[key] || this.translations["en"]?.[key] || key;
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  }

  applyTranslations() {
    $("[data-i18n]").each((i, el) => {
      const key = $(el).attr("data-i18n");
      $(el).text(this.t(key));
    });
    $("[data-i18n-placeholder]").each((i, el) => {
      const key = $(el).attr("data-i18n-placeholder");
      $(el).attr("placeholder", this.t(key));
    });
    $("[data-i18n-value]").each((i, el) => {
      const key = $(el).attr("data-i18n-value");
      $(el).val(this.t(key));
    });

    const flagMap = {
      ru: "ru", en: "gb", ua: "ua", kz: "kz", de: "de", es: "es", fr: "fr", by: "by", zh: "cn"
    };
    const langNames = {
      ru: 'Русский (RU)', en: 'English (EN)', ua: 'Українська (UA)', kz: 'Қазақша (KZ)',
      de: 'Deutsch (DE)', es: 'Español (ES)', fr: 'Français (FR)', by: 'Беларуская (BY)',
      zh: '简体中文 (ZH)'
    };
    const shortNames = {
      ru: "RU", en: "EN", ua: "UA", kz: "KZ", de: "DE", es: "ES", fr: "FR", by: "BY", zh: "ZH"
    };

    const flag = flagMap[this.lang] || "gb";
    const flagUrl = `./libs/flags/${flag}.svg`;

    const setSrc = (id, url) => {
      const el = document.getElementById(id);
      if (el && url) el.setAttribute("src", url);
    };

    setSrc("current-lang-flag", flagUrl);
    $("#current-lang-text").text(shortNames[this.lang] || this.lang.toUpperCase());
    setSrc("current-lang-flag-modal", flagUrl);
    $("#current-lang-text-modal").text(langNames[this.lang] || langNames["en"]);

    $(".lang-select-item").removeClass("active");
    $(`.lang-select-item[data-lang="${this.lang}"]`).addClass("active");

    $("#html-root").attr("lang", this.lang);
    this.updateCacheInfo().catch(() => { });
    this.renderRecent();
  }

  updateCurrentProgress() {
    const now = Date.now();
    const ch = this.channels[this.currentChannelIndex];
    if (!ch) return;
    const id = ch.id || this.norm2id[this.normalize(ch.name)];
    const prog = this.getCurrentProgram(id);
    if (!prog) return;

    const total = prog.end - prog.start;
    const elapsed = Math.max(0, Math.min(total, now - prog.start));
    const percent = total ? Math.round((elapsed / total) * 100) : 0;
    $(".current-progress-bar").css("width", percent + "%");
  }

  bindEvents() {
    $("#btn-go-categories").on("click", async () => {
      if (!this.selectedPlaylistId)
        return this.toast(this.t("toast_no_playlist"), "warning");
      this.showLoader(true);
      try {
        const pl = this.playlists.find((p) => p.id === this.selectedPlaylistId);
        this.ensureDefaultEpgForPlaylist(pl);
        if (!pl) {
          this.toast(this.t("toast_pl_not_found"), "danger");
          return;
        }
        await this.loadPlaylist(pl, this.cacheData);
        this.switchPage("categories");
        this.ensureEpgLoaded(pl).catch((e) => {
          console.error("Background EPG load error:", e);
        });
      } catch (e) {
        console.error("Open categories error:", e);
        if (e.message.includes("fetch") || e.name === "TypeError") {
          this.toast(this.t("toast_cors_error"), "danger");
        } else {
          this.toast(this.t("toast_load_error"), "danger");
        }
      } finally {
        this.showLoader(false);
      }
    });

    $("#btn-cat-back").on("click", () => this.switchPage("manage"));
    $("#btn-ch-back").on("click", () => this.switchPage("categories"));
    $("#btn-player-back").on("click", () => {
      this.stopPlayer();
      this.switchPage("channels");
    });

    $("#btn-prev-ch").on("click", () => this.jumpChannel(-1));
    $("#btn-next-ch").on("click", () => this.jumpChannel(1));
    $("#btn-cast").on("click", () => {
      this.toggleCast();
    });
    $("#btn-copy-lan-player-url").on("click", () => this.copyLanFieldValue("#lan-player-url"));
    $("#btn-copy-lan-stream-url").on("click", () => this.copyLanFieldValue("#lan-stream-url"));

    $("#btn-save-playlist").on("click", () => this.savePlaylist());
    $("#inp-epg").on("change", (e) =>
      $("#epg-block").toggle(e.target.checked)
    );

    $("#cat-search").on("input", this.onCategorySearch);
    $("#ch-search").on("input", this.onChannelSearch);
    $("#btn-ch-toggle").on("click", () => this.toggleView());
    $("#btn-fullscreen").on("click", () => this.toggleFullscreen());
    $("#btn-scroll-top-channels").on("click", () => this.scrollToTop());
    $("#btn-scroll-top-player").on("click", () => this.scrollToTop());
    this.setupPlayerUi();

    $(".video-wrapper").off("click.playerResume").on("click.playerResume", ".video-pause-overlay", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const video = document.getElementById("video");
      if (video && video.paused) {
        video.play().catch(() => { });
      }
    });

    $("#cacheData")
      .prop("checked", this.cacheData)
      .on("change", () => {
        this.cacheData = $("#cacheData").prop("checked");
        localStorage.setItem("cacheData", this.cacheData);
        if (!this.cacheData) {
          this.clearCache();
        }
      });

    $("#btn-clear-cache").on("click", () => {
      this.clearCache();
    });

    window.addEventListener("beforeunload", () => this.stopPlayer());

    $(document).on("click", ".lang-select-item", (e) => {
      e.preventDefault();
      const targetLang = $(e.currentTarget).data("lang");
      if (targetLang === this.lang) return;

      this.lang = targetLang;
      localStorage.setItem("lang", this.lang);
      this.applyTranslations();
      this.renderManage();
      if ($("#page-categories").hasClass("active")) this.renderCategories();
      if ($("#page-channels").hasClass("active")) this.renderChannels();
      if ($("#page-player").hasClass("active")) {
        this.updateEpgMini();
      }
    });

    document
      .querySelectorAll('[data-bs-toggle="tooltip"]')
      .forEach((el) => {
        new bootstrap.Tooltip(el);
      });
  }

  bindDeviceModeControls() {
    $("#buildVariant")
      .val(this.buildVariant)
      .on("change", () => {
        this.buildVariant = $("#buildVariant").val();
        localStorage.setItem("buildVariant", this.buildVariant);
        this.applyDeviceProfile();
      });

    $("#uiMode")
      .val(this.uiModePreference)
      .on("change", () => {
        this.uiModePreference = $("#uiMode").val();
        localStorage.setItem("uiMode", this.uiModePreference);
        this.applyDeviceProfile();
      });

    window.addEventListener("resize", () => this.applyDeviceProfile());
  }

  detectDeviceMode() {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const hasTouch = window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0;
    const isTvLike = !hasTouch && width >= 960;

    if (this.uiModePreference && this.uiModePreference !== "auto") {
      return this.uiModePreference;
    }

    if (this.buildVariant === "android-touch") {
      return width >= 820 ? "tablet" : "mobile";
    }

    if (isTvLike) return "tv";
    return width >= 820 ? "tablet" : "mobile";
  }

  applyDeviceProfile() {
    const nextMode = this.detectDeviceMode();
    this.deviceMode = nextMode;

    document.body.classList.remove("device-mobile", "device-tablet", "device-tv", "build-android-touch", "build-universal");
    document.body.classList.add(`device-${nextMode}`);
    document.body.classList.add(this.buildVariant === "universal" ? "build-universal" : "build-android-touch");

    const summaryMap = {
      mobile: "Активен телефонный режим: компактный touch-интерфейс для Android смартфонов.",
      tablet: "Активен планшетный режим: более широкий интерфейс и увеличенные блоки.",
      tv: "Активен TV-режим: крупные элементы, управление стрелками, Enter и Back."
    };

    const variantLabel = this.buildVariant === "universal"
      ? "Сборка: универсальная"
      : "Сборка: Android телефоны и планшеты";

    $("#device-mode-summary").text(`${variantLabel}. ${summaryMap[nextMode] || ""}`);

    this.refreshTvFocusable();
  }

  initRemoteNavigation() {
    document.addEventListener("keydown", (e) => {
      if (this.deviceMode !== "tv") return;

      const key = e.key;
      const directionalKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      const activateKeys = ["Enter", " "];
      const backKeys = ["Escape", "Backspace", "BrowserBack"];

      if (directionalKeys.includes(key)) {
        e.preventDefault();
        this.moveTvFocus(key);
        return;
      }

      if (activateKeys.includes(key)) {
        const active = this.tvFocusables[this.tvFocusIndex] || document.activeElement;
        if (active) {
          e.preventDefault();
          active.click();
        }
        return;
      }

      if (backKeys.includes(key)) {
        e.preventDefault();
        this.handleTvBack();
      }
    });
  }

  refreshTvFocusable() {
    if (this.deviceMode !== "tv") {
      this.tvFocusables = [];
      this.tvFocusIndex = -1;
      return;
    }

    const selectors = [
      ".page.active .playlist-item",
      ".page.active .channel-card",
      ".page.active button:not(.btn-close)",
      ".page.active .btn-player",
      ".page.active .form-control",
      ".page.active .form-select",
      ".page.active .dropdown-toggle",
      ".modal.show button",
      ".modal.show input",
      ".modal.show .form-select"
    ].join(",");

    this.tvFocusables = Array.from(document.querySelectorAll(selectors))
      .filter((el) => el.offsetParent !== null && !el.disabled);

    this.tvFocusables.forEach((el) => {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      el.classList.add("tv-focusable");
    });

    const current = document.activeElement;
    const existingIndex = this.tvFocusables.indexOf(current);
    this.tvFocusIndex = existingIndex >= 0 ? existingIndex : (this.tvFocusables.length ? 0 : -1);

    if (this.tvFocusIndex >= 0) {
      this.focusTvElement(this.tvFocusIndex, false);
    }
  }

  focusTvElement(index, scroll = true) {
    if (!this.tvFocusables.length) return;

    this.tvFocusables.forEach((el) => el.classList.remove("tv-focus"));
    const normalizedIndex = (index + this.tvFocusables.length) % this.tvFocusables.length;
    const el = this.tvFocusables[normalizedIndex];
    this.tvFocusIndex = normalizedIndex;
    el.classList.add("tv-focus");
    el.focus({ preventScroll: !scroll });
    if (scroll) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }

  moveTvFocus(key) {
    this.refreshTvFocusable();
    if (!this.tvFocusables.length) return;

    const step = (key === "ArrowLeft" || key === "ArrowUp") ? -1 : 1;
    const nextIndex = this.tvFocusIndex < 0 ? 0 : this.tvFocusIndex + step;
    this.focusTvElement(nextIndex);
  }

  handleTvBack() {
    if ($(".modal.show").length) {
      const modalEl = document.querySelector(".modal.show");
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
      return;
    }

    if ($("#page-player").hasClass("active")) {
      this.stopPlayer();
      this.switchPage("channels");
      return;
    }

    if ($("#page-channels").hasClass("active")) {
      this.switchPage("categories");
      return;
    }

    if ($("#page-categories").hasClass("active")) {
      this.switchPage("manage");
    }
  }

  setupPlayerUi() {
    const video = document.getElementById("video");
    if (!video) return;

    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    $("#btn-pip").off("click").on("click", () => this.togglePip());
    this.initPipEvents();
    this.initPlaybackStateEvents();
    this.initVideoErrorEvents();
    this.updatePipAvailability();
    this.updatePauseOverlay();
  }

  updatePipAvailability() {
    const video = document.getElementById("video");
    const hasStandardPip = !!(
      video &&
      document.pictureInPictureEnabled &&
      typeof video.requestPictureInPicture === "function"
    );
    const hasWebkitPip = !!(
      video &&
      typeof video.webkitSupportsPresentationMode === "function" &&
      video.webkitSupportsPresentationMode("picture-in-picture")
    );

    $("#btn-pip").toggle(hasStandardPip || hasWebkitPip);
  }

  updatePauseOverlay(forceState = null) {
    const video = document.getElementById("video");
    const shouldShow =
      typeof forceState === "boolean"
        ? forceState
        : !!(video && video.currentSrc && video.paused && !video.ended);

    $(".video-wrapper").toggleClass("is-paused", !!shouldShow);
  }

  initPlaybackStateEvents() {
    const video = document.getElementById("video");
    if (!video || video.dataset.stateEventsBound === "true") return;

    const syncOverlay = () => {
      const showPaused = !!(video.currentSrc && video.paused && !video.ended);
      this.updatePauseOverlay(showPaused);
    };

    ["play", "playing", "seeking", "waiting", "loadeddata", "emptied"].forEach((eventName) => {
      video.addEventListener(eventName, () => this.updatePauseOverlay(false));
    });

    ["pause", "ended"].forEach((eventName) => {
      video.addEventListener(eventName, syncOverlay);
    });

    video.dataset.stateEventsBound = "true";
  }

  initVideoErrorEvents() {
    const video = document.getElementById("video");
    if (!video || video.dataset.errorEventsBound === "true") return;

    video.addEventListener("error", () => {
      if (this.suppressVideoErrors) {
        return;
      }
      const mediaError = video.error;
      const errorMap = {
        1: "Воспроизведение отменено пользователем",
        2: "Ошибка сети при загрузке потока",
        3: "Ошибка декодирования видео/аудио",
        4: "Формат потока не поддерживается устройством или браузером",
      };
      const message = mediaError
        ? errorMap[mediaError.code] || `Неизвестная media error (${mediaError.code})`
        : "Неизвестная ошибка HTML5-видео";

      console.error("Video element error:", mediaError, "src:", video.currentSrc);
      this.showLoader(false);
      this.updatePauseOverlay(false);
      this.toast("Ошибка воспроизведения: " + message, "danger");
    });

    video.dataset.errorEventsBound = "true";
  }

  cleanupVideoElement() {
    const video = document.getElementById("video");
    if (!video) return;

    this.suppressVideoErrors = true;

    try {
      video.pause();
    } catch (e) { }

    try {
      video.removeAttribute("src");
      video.srcObject = null;
      video.load();
    } catch (e) { }

    this.updatePauseOverlay(false);

    setTimeout(() => {
      this.suppressVideoErrors = false;
    }, 300);
  }

  getHlsErrorMessage(data) {
    if (!data) return "Неизвестная ошибка HLS";

    const typeMap = {
      networkError: "Ошибка сети при загрузке потока",
      mediaError: "Ошибка декодирования медиапотока",
      muxError: "Ошибка обработки контейнера потока",
      keySystemError: "Ошибка DRM/ключей",
      otherError: "Внутренняя ошибка проигрывателя",
    };

    const detailMap = {
      manifestLoadError: "Не удалось загрузить m3u8 manifest",
      manifestLoadTimeOut: "Таймаут загрузки m3u8 manifest",
      manifestParsingError: "Ошибка разбора m3u8 manifest",
      levelLoadError: "Не удалось загрузить сегменты качества",
      levelLoadTimeOut: "Таймаут загрузки сегментов качества",
      fragLoadError: "Не удалось загрузить видео-сегмент",
      fragLoadTimeOut: "Таймаут загрузки видео-сегмента",
      fragParsingError: "Ошибка разбора видео-сегмента",
      bufferAppendError: "Ошибка добавления данных в буфер воспроизведения",
      bufferStalledError: "Буферизация остановилась — поток нестабилен или слишком медленный",
    };

    return detailMap[data.details] || typeMap[data.type] || data.details || data.type || "Неизвестная ошибка HLS";
  }

  async clearCache() {
    try {
      await this.db.clear("cache");
      console.log("Cache cleared");
      this.toast(this.t("toast_cache_cleared"), "info");
      await this.updateCacheInfo();
    } catch (e) {
      console.warn("Error clearing cache:", e);
    }
  }

  getSelectedEpg(playlist = null) {
    if (!this.enableEpg) return null;
    const epgId = this.selectedEpgId || playlist?.epgId || null;
    return epgId ? this.epgs.find((e) => e.id === epgId) || null : null;
  }

  async ensureEpgLoaded(playlist = null, forceRefresh = false) {
    if (!this.enableEpg) {
      this.schedule = {};
      this.epgIcons = {};
      this.epgChannelNames = {};
      this.epgDisplayNameToId = {};
      this.id2info = {};
      this.norm2id = {};
      this.epgLoadedForId = null;
      return false;
    }
    const ep = this.getSelectedEpg(playlist);
    if (!ep) {
      this.schedule = {};
      this.epgIcons = {};
      this.epgChannelNames = {};
      this.epgDisplayNameToId = {};
      this.id2info = {};
      this.norm2id = {};
      this.epgLoadedForId = null;
      return false;
    }

    if (!forceRefresh && this.epgLoadedForId === ep.id && Object.keys(this.schedule).length) {
      return true;
    }

    this.epgMatchCache.clear();

    if (!forceRefresh && this.epgLoadingPromise) {
      return this.epgLoadingPromise;
    }

    this.setLoadingState("epg", true, this.t("updating_data"));
    this.epgLoadingPromise = this.loadEpg(ep, this.cacheData)
      .then(() => {
        this.epgLoadedForId = ep.id;
        this.updateChannelCardsWithEpg();
        this.updateCacheInfo();
        if ($("#page-player").hasClass("active")) {
          this.updateEpgMini();
        }
        return true;
      })
      .catch((e) => {
        this.epgLoadedForId = null;
        throw e;
      })
      .finally(() => {
        this.setLoadingState("epg", false);
        this.epgLoadingPromise = null;
      });

    return this.epgLoadingPromise;
  }

  updateChannelCardsWithEpg() {
    if ($("#page-categories").hasClass("active")) {
      this.renderCategories();
    }
    if ($("#page-channels").hasClass("active")) {
      this.renderChannels();
    }
    if ($("#page-player").hasClass("active")) {
      this.updateEpgMini();
    }
  }

  toggleView() {
    this.isListView = !this.isListView;
    localStorage.setItem("isListView", this.isListView);
    $("#btn-ch-toggle i")
      .attr("class", this.isListView ? "fas fa-list" : "fas fa-th-large");
    this.renderChannels();
  }

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  switchPage(page) {
    if (this.epgTimer) {
      clearInterval(this.epgTimer);
      this.epgTimer = null;
    }
    $(".page").removeClass("active");
    $(`#page-${page}`).addClass("active");
    if (page === "categories") this.renderCategories();
    if (page === "channels") this.renderChannels();
    if (page === "player") this.updateEpgMini();
    setTimeout(() => this.refreshTvFocusable(), 30);
  }

  renderManage() {
    const list = $("#manage-playlist-list").empty();
    $("#playlist-count").text(this.playlists.length);
    $("#epg-count").text(this.epgs.length);

    if (!this.playlists.length) {
      list.append(`
                  <div class="manage-empty">
                    <div class="mb-2"><i class="fas fa-list fa-2x"></i></div>
                    <div class="fw-semibold mb-1" data-i18n="toast_no_playlist">Плейлисты ещё не добавлены</div>
                    <div class="small" data-i18n="manage_empty_desc">Нажмите «Добавить», чтобы загрузить M3U файл или указать URL.</div>
                  </div>
                `);
    }

    this.playlists.forEach((p) => {
      const isActive = p.id === this.selectedPlaylistId;
      const hasEpg = !!this.getSelectedEpg(p);
      const sourceLabel = p.url ? this.t("source_url") : (p.fileName || this.t("source_local"));
      const item = $(`
            <label class="playlist-item ${isActive ? "active" : ""}">
              <div class="playlist-main">
                <div class="playlist-top-row">
                  <input class="form-check-input playlist-radio" type="radio" name="playlist" value="${p.id}" ${isActive ? "checked" : ""}>
                  <div class="playlist-badge-icon"><i class="fas fa-photo-film"></i></div>
                </div>
                <div class="min-w-0 w-100">
                  <div class="playlist-name">${p.name}</div>
                  <div class="playlist-meta">${sourceLabel}</div>
                  <div class="playlist-status-row mt-2">
                    <span class="badge text-bg-${hasEpg ? "success" : "secondary"}">${hasEpg ? this.t("epg_connected") : this.t("no_epg")}</span>
                    ${isActive ? `<span class="badge text-bg-primary">${this.t("active_badge")}</span>` : ""}
                  </div>
                </div>
              </div>
              <div class="playlist-actions">
                <button class="btn btn-sm btn-outline-warning edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger delete"><i class="fas fa-trash"></i></button>
              </div>
            </label>`);
      item.find("input").on("change", (e) => {
        e.stopPropagation();
        this.selectedPlaylistId = e.target.value;
        const playlist = this.playlists.find((p) => p.id === this.selectedPlaylistId);
        this.ensureDefaultEpgForPlaylist(playlist);
        this.selectedEpgId = playlist?.epgId || null;
        localStorage.setItem("selectedPlaylistId", this.selectedPlaylistId);
        if (this.selectedEpgId) {
          localStorage.setItem("selectedEpgId", this.selectedEpgId);
        } else {
          localStorage.removeItem("selectedEpgId");
        }
        this.renderManage();
        this.updateCacheInfo();
      });
      item.find(".edit").on("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.editPlaylist(p.id);
      });
      item.find(".delete").on("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.deletePlaylist(p.id);
      });
      item.on("click", async (e) => {
        if ($(e.target).closest("button, input").length) return;
        this.selectedPlaylistId = p.id;
        this.ensureDefaultEpgForPlaylist(p);
        this.selectedEpgId = p.epgId || null;
        localStorage.setItem("selectedPlaylistId", p.id);
        if (this.selectedEpgId) localStorage.setItem("selectedEpgId", this.selectedEpgId);
        else localStorage.removeItem("selectedEpgId");
        this.renderManage();
        $("#btn-go-categories").trigger("click");
      });
      list.append(item);

    this.refreshTvFocusable();
    });

    $("#autoLoad")
      .prop("checked", this.autoLoad)
      .on("change", () => {
        this.autoLoad = $("#autoLoad").prop("checked");
        localStorage.setItem("autoLoad", this.autoLoad);
      });
    $("#enableEpg")
      .prop("checked", this.enableEpg)
      .on("change", async () => {
        this.enableEpg = $("#enableEpg").prop("checked");
        localStorage.setItem("enableEpg", this.enableEpg);
        if (!this.enableEpg) {
          this.schedule = {};
          this.epgIcons = {};
          this.epgChannelNames = {};
          this.epgDisplayNameToId = {};
          this.id2info = {};
          this.norm2id = {};
          this.epgLoadedForId = null;
          this.updateChannelCardsWithEpg();
        } else if (this.selectedPlaylistId) {
          const pl = this.playlists.find((p) => p.id === this.selectedPlaylistId);
          this.ensureDefaultEpgForPlaylist(pl);
          await this.ensureEpgLoaded(pl, true).catch(() => { });
        }
        this.renderManage();
        this.updateCacheInfo();
      });
  }

  async savePlaylist() {
    const editId = $("#btn-save-playlist").data("edit-id");
    if (editId) return this.updatePlaylist(editId);
    let name = $("#inp-name").val().trim();
    const file = $("#inp-file")[0].files[0];
    const url = $("#inp-url").val().trim();

    if (!name) {
      name = this.t("pl_name_placeholder") + " #" + Math.floor(Math.random() * 900 + 100);
    }

    if (!file && !url)
      return this.toast(this.t("toast_load_error"), "danger");

    const id = Date.now().toString();
    const playlist = { id, name };
    if (file) {
      playlist.contentText = await file.text();
      playlist.fileName = file.name;
      playlist.isGz = file.name.endsWith(".gz");
    } else {
      playlist.url = url;
      playlist.isGz = url.endsWith(".gz");
    }

    if ($("#inp-epg").prop("checked")) {
      const epgName = $("#inp-epg-name").val().trim();
      const epgFile = $("#inp-epg-file")[0].files[0];
      const epgUrl = $("#inp-epg-url").val().trim() || this.getDefaultEpgUrl();
      if (epgFile || epgUrl) {
        const epgId = Date.now().toString() + "-epg";
        const epg = { id: epgId, name: epgName || this.t("epg_default_name") };
        if (epgFile) {
          if (epgFile.name.endsWith(".gz")) {
            const arrayBuffer = await epgFile.arrayBuffer();
            const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: "string" });
            epg.contentText = decompressed;
          } else {
            epg.contentText = await epgFile.text();
          }
          epg.fileName = epgFile.name;
        } else {
          epg.url = epgUrl;
        }
        this.epgs.push(epg);
        playlist.epgId = epgId;
        this.selectedEpgId = epgId;
        localStorage.setItem("selectedEpgId", epgId);
        localStorage.setItem("epgs", JSON.stringify(this.epgs));
      }
    }

    this.playlists.push(playlist);
    this.selectedPlaylistId = id;
    localStorage.setItem("playlists", JSON.stringify(this.playlists));
    localStorage.setItem("selectedPlaylistId", id);
    this.renderManage();
    this.toast(this.t("toast_pl_saved"), "success");
    $("#playlistModal").modal("hide");
    this.clearPlaylistForm();
  }

  clearPlaylistForm() {
    $("#inp-name").val("");
    $("#inp-url").val("");
    $("#inp-file").val("");
    $("#inp-epg-name").val("EPG по умолчанию");
    $("#inp-epg-url").val("");
    $("#inp-epg-file").val("");
    $("#btn-save-playlist").removeData("edit-id");
    $("#current-source").text("");
  }

  editPlaylist(id) {
    const p = this.playlists.find((p) => p.id === id);
    if (!p) return;
    $("#inp-name").val(p.name);
    if (p.url) {
      $("#inp-url").val(p.url);
      $("#current-source").text("Текущий URL: " + p.url);
        } else if (p.fileName) {
          $("#current-source").text("Текущий файл: " + p.fileName);
    }
    if (p.epgId) {
      $("#inp-epg").prop("checked", true);
      const ep = this.epgs.find((e) => e.id === p.epgId);
      if (ep) {
        $("#inp-epg-name").val(ep.name);
        if (ep.url) $("#inp-epg-url").val(ep.url);
      }
    }
    $("#btn-save-playlist").data("edit-id", id);
    $("#playlistModal").modal("show");
  }

  async updatePlaylist(id) {
    const p = this.playlists.find((p) => p.id === id);
    if (!p) return;
    let name = $("#inp-name").val().trim();
    if (!name) {
      name = "Мой плеер #" + Math.floor(Math.random() * 900 + 100);
    }
    p.name = name;
    const file = $("#inp-file")[0].files[0];
    const url = $("#inp-url").val().trim();
    if (file) {
      p.contentText = await file.text();
      p.fileName = file.name;
      p.isGz = file.name.endsWith(".gz");
      delete p.url;
    } else if (url) {
      p.url = url;
      p.isGz = url.endsWith(".gz");
      delete p.contentText;
      delete p.fileName;
    }

    await this.db.delete("cache", this.getCacheKey("playlist", p.id));
    await this.db.delete("cache", this.getCacheKey("playlist_parsed", p.id));

    const useEpg = $("#inp-epg").prop("checked");
    const epgName = $("#inp-epg-name").val().trim();
    const epgFile = $("#inp-epg-file")[0].files[0];
    const epgUrl = $("#inp-epg-url").val().trim() || this.getDefaultEpgUrl();

    if (useEpg) {
      let ep = p.epgId ? this.epgs.find((e) => e.id === p.epgId) : null;
      if (!ep) {
        const epgId = Date.now().toString() + "-epg";
        ep = { id: epgId, name: epgName || "EPG" };
        this.epgs.push(ep);
        p.epgId = epgId;
      }

      ep.name = epgName || ep.name || "EPG";
      delete ep.contentText;
      delete ep.fileName;
      delete ep.url;

      if (epgFile) {
        if (epgFile.name.endsWith(".gz")) {
          const arrayBuffer = await epgFile.arrayBuffer();
          const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: "string" });
          ep.contentText = decompressed;
        } else {
          ep.contentText = await epgFile.text();
        }
        ep.fileName = epgFile.name;
      } else {
        ep.url = epgUrl;
        await this.db.delete("cache", this.getCacheKey("epg_raw", ep.id));
        await this.db.delete("cache", this.getCacheKey("epg_schedule", ep.id));
      }

      this.selectedEpgId = ep.id;
      localStorage.setItem("selectedEpgId", ep.id);
      localStorage.setItem("epgs", JSON.stringify(this.epgs));
    } else if (p.epgId) {
      this.epgs = this.epgs.filter((e) => e.id !== p.epgId);
      delete p.epgId;
      if (this.selectedEpgId && !this.epgs.some((e) => e.id === this.selectedEpgId)) {
        this.selectedEpgId = null;
        localStorage.removeItem("selectedEpgId");
      }
      localStorage.setItem("epgs", JSON.stringify(this.epgs));
    }

    localStorage.setItem("playlists", JSON.stringify(this.playlists));
    this.renderManage();
    this.toast(this.t("toast_pl_updated"), "success");
    $("#playlistModal").modal("hide");
    this.clearPlaylistForm();
  }

  deletePlaylist(id) {
    if (!confirm(this.t("delete_confirm"))) return;
    this.playlists = this.playlists.filter((p) => p.id !== id);
    if (this.selectedPlaylistId === id) {
      this.selectedPlaylistId = null;
      localStorage.removeItem("selectedPlaylistId");
    }
    localStorage.setItem("playlists", JSON.stringify(this.playlists));
    this.renderManage();
  }


  /* =========  History  ========= */
  addToHistory(channel) {
    this.history = this.history.filter(ch => ch.id !== channel.id);
    this.history.unshift(channel);
    this.history = this.history.slice(0, 10);
    localStorage.setItem("history", JSON.stringify(this.history));
  }

  removeFromHistory(channelId) {
    this.history = this.history.filter(ch => ch.id !== channelId);
    localStorage.setItem("history", JSON.stringify(this.history));
  }

  /* =========  Load Playlist  ========= */
  async loadPlaylist(pl, useCache = false) {
    const parsedCacheKey = this.getCacheKey("playlist_parsed", pl.id);
    this.setLoadingState("playlist", true, this.t("loading_channels"));
    if (!useCache && this.loadedPlaylistId === pl.id && this.channels.length) {
      this.setLoadingState("playlist", false);
      return;
    }

    if (useCache) {
      const parsed = await this.getCachedData(parsedCacheKey, this.playlistCacheAgeMs);
      if (parsed?.channels?.length) {
        this.channels = parsed.channels;
        this.favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
        this.buildCategories();
        this.loadedPlaylistId = pl.id;
        await this.updateCacheInfo();
        this.setLoadingState("playlist", false);
        return;
      }
    }

    let content = null;
    const cacheKey = this.getCacheKey("playlist", pl.id);

    if (useCache) {
      content = await this.getCachedData(cacheKey, this.playlistCacheAgeMs);
    }

    if (!content) {
      if (pl.contentText) {
        content = pl.contentText;
      } else if (pl.url) {
        this.toast(this.t("loading_playlist_toast"), "info");
        const resp = await fetch(pl.url);
        if (!resp.ok) throw new Error(this.t("toast_load_error"));

        if (pl.isGz || (pl.url && pl.url.endsWith(".gz"))) {
          const arrayBuffer = await resp.arrayBuffer();
          content = pako.ungzip(new Uint8Array(arrayBuffer), { to: "string" });
        } else {
          content = await resp.text();
        }

        if (useCache) {
          await this.setCachedData(cacheKey, content);
        }
      } else {
        throw new Error("Нет данных плейлиста");
      }
    }

    this.parsePlaylist(content, false);
    this.loadedPlaylistId = pl.id;

    if (this.channels.length) {
      await this.setCachedData(parsedCacheKey, {
        channels: this.channels,
      });
    }
    await this.updateCacheInfo();
    this.setLoadingState("playlist", false);
  }

  async parsePlaylist(text, isGz) {
    let lines = text.split(/\r?\n/);

    if (text.startsWith("\x1f\x8b")) {
      try {
        const charData = text.split("").map(x => x.charCodeAt(0));
        text = pako.ungzip(new Uint8Array(charData), { to: "string" });
        lines = text.split(/\r?\n/);
      } catch (e) {
        console.error("Decompression failed in parser", e);
      }
    }

    this.channels = [];
    let channel = null;
    let groupTitle = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTGRP:")) {
        groupTitle = line.substring(8).trim();
        continue;
      }

      if (line.startsWith("#EXTINF:")) {
        channel = { props: {} };

        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        if (tvgIdMatch && tvgIdMatch[1]) {
          channel.tvgId = tvgIdMatch[1];
        }

        const groupMatch = line.match(/group-title="([^"]*)"/);
        if (groupMatch && groupMatch[1]) groupTitle = groupMatch[1];
        channel.groupTitle = groupTitle || this.t("no_category");

        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        if (logoMatch) channel.logo = logoMatch[1];

        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) channel.name = nameMatch[1].trim();
      } else if (line.startsWith("#")) {
        continue;
      } else if (channel && line.startsWith("http")) {
        channel.url = line;
        channel.id = this.normalize(channel.name);
        this.channels.push(channel);
        channel = null;
      }
    }

    this.buildCategories();
  }

  buildCategories() {
    this.categories = { [this.t("favorites_cat")]: [] };
    this.tvgIdToChannel = {};

    this.channels.forEach(ch => {
      const group = ch.groupTitle || "Без категории";
      if (!this.categories[group]) {
        this.categories[group] = [];
      }
      this.categories[group].push(ch);

      if (ch.tvgId) {
        this.tvgIdToChannel[ch.tvgId] = ch;
      }
    });
    this.favorites.forEach(favName => {
      const ch = this.channels.find(c => c.name === favName);
      if (ch) this.categories[this.t("favorites_cat")].push(ch);
    });
  }

  normalize(str) {
    return (str || "").toLowerCase().replace(/[^а-яa-z0-9]/g, "");
  }

  /* =========  EPG  ========= */
  async loadEpg(ep, useCache = false) {
    const metaCacheKey = this.getCacheKey("epg_meta", ep.id);
    const scheduleCacheKey = this.getCacheKey("epg_schedule", ep.id);
    if (useCache) {
      const [metaParsed, scheduleParsed] = await Promise.all([
        this.getCachedData(metaCacheKey, this.epgMetaCacheAgeMs),
        this.getCachedData(scheduleCacheKey, this.epgScheduleCacheAgeMs),
      ]);
      if (metaParsed) {
        this.epgIcons = metaParsed.epgIcons || {};
        this.epgChannelNames = metaParsed.epgChannelNames || {};
        this.epgDisplayNameToId = metaParsed.epgDisplayNameToId || {};
      }
      if (metaParsed && scheduleParsed?.schedule) {
        this.schedule = scheduleParsed.schedule || {};
        this.id2info = scheduleParsed.id2info || {};
        this.norm2id = {
          ...(metaParsed.norm2id || {}),
          ...(scheduleParsed.norm2id || {}),
        };
        return;
      }
    }

    let content = null;
    const cacheKey = this.getCacheKey("epg_raw", ep.id);

    if (useCache) {
      content = await this.getCachedData(cacheKey, this.epgRawCacheAgeMs);
    }

    if (!content) {
      if (ep.contentText) {
        content = ep.contentText;
      } else if (ep.url) {
        this.toast(this.t("loading_epg_toast"), "info");
        const resp = await fetch(ep.url);
        if (!resp.ok) throw new Error(this.t("toast_load_error"));

        const arrayBuffer = await resp.arrayBuffer();
        try {
          content = await this.decompressGzip(arrayBuffer);
        } catch (e) {
          const decoder = new TextDecoder("utf-8");
          content = decoder.decode(arrayBuffer);
        }

        if (useCache) {
          await this.setCachedData(cacheKey, content);
        }
      } else {
        throw new Error("Нет данных EPG");
      }
    }

    this.parseEpg(content);

    if (Object.keys(this.schedule).length) {
      await this.setCachedData(metaCacheKey, {
        epgIcons: this.epgIcons,
        epgChannelNames: this.epgChannelNames,
        epgDisplayNameToId: this.epgDisplayNameToId,
        norm2id: this.norm2id,
      });
      await this.setCachedData(scheduleCacheKey, {
        schedule: this.schedule,
        id2info: this.id2info,
        norm2id: this.norm2id,
      });
    }
  }

  async decompressGzip(arrayBuffer) {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(arrayBuffer);
    writer.close();
    const response = new Response(ds.readable);
    return await response.text();
  }

  renderMiniLoading() {
    if (!document.getElementById("mini-epg-loading")) {
      $("#mini-epg").after(
        `<div id="mini-epg-loading" class="mini-loading" style="display:none;"><span class="loading-dot me-2"></span>${this.t("updating_data")}</div>`
      );
    }
  }

  parseEpg(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");
    const programmes = xml.querySelectorAll("programme");

    this.epgIcons = {};
    this.epgChannelNames = {};
    this.epgDisplayNameToId = {};
    this.norm2id = {};
    xml.querySelectorAll("channel").forEach(ch => {
      const id = ch.getAttribute("id");
      const icon = ch.querySelector("icon")?.getAttribute("src");
      const displayNames = Array.from(ch.querySelectorAll("display-name"))
        .map((node) => node.textContent?.trim())
        .filter(Boolean);
      if (id && icon) {
        this.epgIcons[id] = icon;
      }
      if (id) {
        this.epgChannelNames[id] = displayNames;
        displayNames.forEach((name) => {
          const normalized = this.normalize(name);
          if (normalized) {
            this.epgDisplayNameToId[normalized] = id;
            this.norm2id[normalized] = id;
          }
        });
      }
    });

    this.schedule = {};
    this.id2info = {};

    Object.entries(this.epgDisplayNameToId).forEach(([normName, id]) => {
      this.norm2id[normName] = id;
    });

    programmes.forEach(p => {
      const ch = p.getAttribute("channel");
      const start = this.parseEpgDate(p.getAttribute("start"));
      const end = this.parseEpgDate(p.getAttribute("stop"));
      const title = p.querySelector("title")?.textContent || this.t("toast_no_data");
      const desc = p.querySelector("description")?.textContent || "";

      const normCh = this.normalize(ch);
      this.norm2id[normCh] = ch;

      if (!this.schedule[ch]) this.schedule[ch] = [];
      this.schedule[ch].push({ start, end, title, desc });

      const now = Date.now();
      if (start <= now && now <= end) {
        this.id2info[ch] = { title, desc, start, end };
      }
    });

    Object.keys(this.schedule).forEach(ch => {
      this.schedule[ch].sort((a, b) => a.start - b.start);
    });

    this.toast(this.t("epg_loaded_toast", { n: Object.keys(this.schedule).length }), "success");
  }

  parseEpgDate(str) {
    const match = str.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
    if (!match) return 0;
    const [, y, mo, d, h, mi, s, tz] = match;
    const date = new Date(y, mo - 1, d, h, mi, s);
    if (tz) {
      const tzOffset = parseInt(tz.slice(0, 3)) * 60 + parseInt(tz.slice(3));
      date.setMinutes(date.getMinutes() - tzOffset);
    }
    return date.getTime();
  }

  getCurrentProgram(chId) {
    if (!this.schedule[chId]) return null;
    const now = Date.now();
    return this.schedule[chId].find(p => p.start <= now && now <= p.end);
  }

  getNextProgram(chId) {
    if (!this.schedule[chId]) return null;
    const now = Date.now();
    return this.schedule[chId].find(p => p.start > now) || null;
  }


  /* =========  Render  ========= */
  renderCategories() {
    const grid = $("#categories-grid").empty();
    const search = $("#cat-search").val().toLowerCase();

    const sortedCats = Object.keys(this.categories).sort((a, b) => a.localeCompare(b));

    sortedCats.forEach(cat => {
      if (cat === "Избранное" && this.categories[cat].length === 0) return;
      if (search && !cat.toLowerCase().includes(search)) return;

      const chList = this.categories[cat];

      const card = $(`
          <div class="col-6 col-md-4 col-lg-3">
            <div class="glass card-hover p-3 text-center channel-card" data-cat="${cat}" tabindex="0">
              <i class="fas ${this.getCategoryIcon(cat)} fa-2x mb-2"></i>
              <div class="card-title">${cat}</div>
              <div class="text-muted small">${chList.length} каналов</div>
            </div>
          </div>`);
      card.on("click", () => this.openCategory(cat));
      grid.append(card);
    });

    this.refreshTvFocusable();
  }

  getCacheKey(prefix, id) {
    return `${prefix}_${id}_${this.cacheVersion}`;
  }

  openCategory(cat) {
    this.currentCategory = cat;
    this.categoryChannels = this.categories[cat] || [];
    this.switchPage("channels");
  }

  renderChannels() {
    const grid = $("#channels-grid").empty();
    const search = $("#ch-search").val().toLowerCase();
    grid.toggleClass("channels-list-mode", this.isListView);
    $("#btn-ch-toggle i")
      .attr("class", this.isListView ? "fas fa-list" : "fas fa-th-large");

    let list = this.categoryChannels;
    list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (search) {
      list = list.filter(ch => (ch.name || "").toLowerCase().includes(search));
    }

    if (list.length === 0) {
      return grid.append(`<div class="text-center text-muted">${this.t("channels_not_found")}</div>`);
    }

    list.forEach((ch, idx) => {
      const realIdx = this.channels.indexOf(ch);
      const isFav = this.favorites.includes(ch.name);
      const epgChannelId = this.getEpgChannelId(ch);
      const prog = epgChannelId ? this.getCurrentProgram(epgChannelId) : null;
      const nextProg = epgChannelId ? this.getNextProgram(epgChannelId) : null;
      const icon = this.getChannelIcon(ch, epgChannelId);
      const colClass = this.isListView ? "col-12" : "col-6 col-md-4 col-lg-3";
      const dFmt = this.lang === "ru" ? "ru-RU" : "en-US";
      const fmtTime = (t) => new Date(t).toLocaleTimeString(dFmt, { hour: "2-digit", minute: "2-digit" });
      const listMeta = this.isListView
        ? `<div class="list-meta">${ch.groupTitle || this.t("no_category")}${ch.tvgId ? ` тАв ID: ${ch.tvgId}` : ""}</div>`
        : "";
      const listExtra = this.isListView
        ? `<div class="list-extra">
                  ${prog ? `<div><strong>${this.t("now_playing")}</strong> ${fmtTime(prog.start)} - ${fmtTime(prog.end)} тАв ${prog.title}</div>` : `<div>${this.t("now_playing")} ${this.t("toast_no_data")}</div>`}
                  ${nextProg ? `<div class="mt-1"><strong>${this.t("next_playing")}</strong> ${fmtTime(nextProg.start)} - ${fmtTime(nextProg.end)} тАв ${nextProg.title}</div>` : ""}
                </div>`
        : "";


      const card = $(`
          <div class="${colClass}">
            <div class="glass card-hover p-2 channel-card" data-idx="${realIdx}" tabindex="0">
              <div class="d-flex align-items-center">
                ${icon ? `<img src="${icon}" class="channel-logo" loading="lazy">` : "<i class=\"fas fa-tv\"></i>"}
                <div class="channel-info">
                  <div class="card-title">${ch.name}</div>
                  ${listMeta}
                  ${prog ? `<div class="card-text">${prog.title}</div>` : ""}
                </div>
                <button class="btn btn-sm fav-btn ${isFav ? "text-warning" : "text-muted"}"><i class="fas fa-star"></i></button>
              </div>
              ${listExtra}
              ${prog ? `
              <div class="channel-progress">
                <div class="channel-progress-bar" style="width: ${this.getProgress(prog)}%"></div>
              </div>` : ""}
            </div>
          </div>`);
      card.find(".channel-card").on("click", (e) => {
        if (!$(e.target).closest(".fav-btn").length) {
          this.playChannel(realIdx);
        }
      });
      card.find(".fav-btn").on("click", () => this.toggleFav(ch.name));
      grid.append(card);
    });

    this.refreshTvFocusable();
  }

  getProgress(prog) {
    const now = Date.now();
    const total = prog.end - prog.start;
    const elapsed = now - prog.start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  toggleFav(name) {
    const idx = this.favorites.indexOf(name);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
    } else {
      this.favorites.push(name);
    }
    localStorage.setItem("favorites", JSON.stringify(this.favorites));
    this.buildCategories();
    this.renderChannels();
    this.updateCacheInfo();
  }


  /* =========  Player  ========= */
  playChannel(idx) {
    this.currentChannelIndex = idx;
    const ch = this.channels[idx];
    const video = document.getElementById("video");

    const selectedPlaylist = this.playlists.find((p) => p.id === this.selectedPlaylistId);
    if (this.enableEpg) {
      this.ensureEpgLoaded(selectedPlaylist).catch((e) => {
        console.error("EPG load on play error:", e);
      });
    }

    this.showLoader(true);
    this.updatePauseOverlay(false);

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (video) {
      this.cleanupVideoElement();
    }

    if (ch.url.includes(".m3u8") && Hls.isSupported()) {
      this.hls = new Hls({
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        backBufferLength: 5,
        enableWorker: true
      });
      this.hls.loadSource(ch.url);
      this.hls.attachMedia(video);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => { });
        this.showLoader(false);
      });
      this.hls.on(Hls.Events.ERROR, (evt, data) => {
        console.error("HLS error:", data);
        if (data.fatal) {
          this.toast("Ошибка воспроизведения: " + this.getHlsErrorMessage(data), "danger");
          this.showLoader(false);

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            try {
              this.hls.startLoad();
              return;
            } catch (e) { }
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try {
              this.hls.recoverMediaError();
              return;
            } catch (e) { }
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = ch.url;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => { });
        this.showLoader(false);
      }, { once: true });
    } else {
      video.src = ch.url;
      video.addEventListener("canplay", () => {
        video.play().catch(() => { });
        this.showLoader(false);
      }, { once: true });
    }

    this.updateEpgMini();
    this.switchPage("player");

    if (this.isCasting()) {
      this.loadCastMedia();
    }
  }

  updateEpgMini() {
    const ch = this.channels[this.currentChannelIndex];
    const epgChannelId = this.getEpgChannelId(ch);
    const prog = epgChannelId ? this.getCurrentProgram(epgChannelId) : null;
    const channelIcon = this.getChannelIcon(ch, epgChannelId);
    const channelName = ch?.name || "Канал";

    if (prog) {
      const dFmt = this.lang === "ru" ? "ru-RU" : "en-US";
      const fmt = (t) => new Date(t).toLocaleTimeString(dFmt, { hour: "2-digit", minute: "2-digit" });
      $("#mini-epg").html(`
              <div class="mini-epg-head">
                <div class="mini-epg-channel">
                  ${channelIcon ? `<img src="${channelIcon}" class="mini-epg-logo" loading="lazy" alt="${channelName}">` : `<div class="mini-epg-logo mini-epg-logo-fallback"><i class="fas fa-tv"></i></div>`}
                  <div class="mini-epg-channel-meta">
                    <div class="mini-epg-channel-name">${channelName}</div>
                    <div class="mini-epg-now-label">${this.t("now_playing")}</div>
                  </div>
                </div>
                <span class="mini-epg-time text-muted">${fmt(prog.start)} - ${fmt(prog.end)}</span>
              </div>
              <div class="mini-epg-title">${prog.title}</div>
            `);
    } else {
      $("#mini-epg").html(`
            <div class="mini-epg-head">
              <div class="mini-epg-channel">
                ${channelIcon ? `<img src="${channelIcon}" class="mini-epg-logo" loading="lazy" alt="${channelName}">` : `<div class="mini-epg-logo mini-epg-logo-fallback"><i class="fas fa-tv"></i></div>`}
                <div class="mini-epg-channel-meta">
                  <div class="mini-epg-channel-name">${channelName}</div>
                </div>
              </div>
            </div>
            <div class="mini-epg-empty"><em>${this.t("no_epg_data")}</em></div>
          `);
    }

    const finalChId = epgChannelId || ch?.id || this.normalize(ch?.name);
    this.renderEpgList(finalChId);
  }

  getChannelIcon(ch, resolvedEpgChannelId = null) {
    if (!ch) return "";
    const epgChannelId = resolvedEpgChannelId || this.getEpgMetaChannelId(ch);
    return (epgChannelId ? this.epgIcons[epgChannelId] : "") || ch.logo || "";
  }

  getEpgChannelId(ch) {
    if (!ch) return null;
    const cacheKey = "id_" + (ch.tvgId || ch.id || ch.name);
    if (this.epgMatchCache.has(cacheKey)) return this.epgMatchCache.get(cacheKey);

    const metaChannelId = this.findEpgChannelIdLogic(ch);
    this.epgMatchCache.set(cacheKey, metaChannelId);
    return metaChannelId;
  }

  getEpgMetaChannelId(ch) {
    if (!ch) return null;
    const cacheKey = "meta_" + (ch.tvgId || ch.id || ch.name);
    if (this.epgMatchCache.has(cacheKey)) return this.epgMatchCache.get(cacheKey);

    const metaChannelId = this.findEpgMetaChannelIdLogic(ch);
    this.epgMatchCache.set(cacheKey, metaChannelId);
    return metaChannelId;
  }

  findEpgMetaChannelIdLogic(ch) {
    if (!ch) return null;
    if (ch.tvgId && this.epgIcons[ch.tvgId]) return ch.tvgId;

    if (ch.tvgId) {
      const tvgIdNorm = this.normalize(ch.tvgId);
      if (this.epgDisplayNameToId[tvgIdNorm]) return this.epgDisplayNameToId[tvgIdNorm];
      if (this.norm2id[tvgIdNorm]) return this.norm2id[tvgIdNorm];
    }

    if (ch.id && this.epgIcons[ch.id]) return ch.id;

    const normName = this.normalize(ch.name);
    if (this.epgDisplayNameToId[normName]) return this.epgDisplayNameToId[normName];
    if (this.norm2id[normName]) return this.norm2id[normName];

    const fuzzyMetaId = this.findFuzzyEpgId(normName, Object.keys(this.epgIcons));
    if (fuzzyMetaId) {
      this.norm2id[normName] = fuzzyMetaId;
      return fuzzyMetaId;
    }

    for (const epgChId of Object.keys(this.epgIcons)) {
      if (this.normalize(epgChId) === normName) return epgChId;
    }
    return null;
  }

  findEpgChannelIdLogic(ch) {
    if (!ch) return null;
    const metaChannelId = this.getEpgMetaChannelId(ch);
    if (metaChannelId && this.schedule[metaChannelId]) return metaChannelId;
    if (ch.tvgId && this.schedule[ch.tvgId]) return ch.tvgId;

    if (ch.tvgId) {
      const tvgIdNorm = this.normalize(ch.tvgId);
      if (this.epgDisplayNameToId[tvgIdNorm] && this.schedule[this.epgDisplayNameToId[tvgIdNorm]]) {
        return this.epgDisplayNameToId[tvgIdNorm];
      }
    }

    if (ch.id && this.schedule[ch.id]) return ch.id;

    const normName = this.normalize(ch.name);
    if (this.epgDisplayNameToId[normName] && this.schedule[this.epgDisplayNameToId[normName]]) {
      this.norm2id[normName] = this.epgDisplayNameToId[normName];
      return this.epgDisplayNameToId[normName];
    }

    if (this.norm2id[normName] && this.schedule[this.norm2id[normName]]) return this.norm2id[normName];

    const fuzzyScheduleId = this.findFuzzyEpgId(normName, Object.keys(this.schedule));
    if (fuzzyScheduleId) {
      this.norm2id[normName] = fuzzyScheduleId;
      return fuzzyScheduleId;
    }

    for (const epgChId of Object.keys(this.schedule)) {
      if (this.normalize(epgChId) === normName) {
        this.norm2id[normName] = epgChId;
        return epgChId;
      }
    }
    return null;
  }

  findFuzzyEpgId(normName, ids) {
    if (!normName || !ids?.length) return null;
    const directDisplay = Object.entries(this.epgDisplayNameToId).find(([displayNorm]) =>
      displayNorm && (displayNorm.includes(normName) || normName.includes(displayNorm))
    );
    if (directDisplay?.[1]) return directDisplay[1];

    for (const id of ids) {
      const normId = this.normalize(id);
      if (normId && (normId.includes(normName) || normName.includes(normId))) return id;

      const displayNames = this.epgChannelNames[id] || [];
      const matchedDisplay = displayNames.find((name) => {
        const normalized = this.normalize(name);
        return normalized && (normalized.includes(normName) || normName.includes(normalized));
      });
      if (matchedDisplay) return id;
    }
    return null;
  }

  renderEpgList(chId) {
    const list = $("#epg-list").empty();
    const progs = this.getVisibleProgramsForToday(chId);
    const now = Date.now();

    progs.forEach(p => {
      const isPast = p.end < now;
      const isFuture = p.start > now;
      const isCurrent = !isPast && !isFuture;
      const cls = isCurrent ? "current" : isPast ? "past" : "future";
      const dFmt = this.lang === "ru" ? "ru-RU" : "en-US";
      const fmt = (t) => new Date(t).toLocaleString(dFmt, {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      });
      list.append(`
              <div class="epg-item ${cls}">
                <div class="small text-muted">${fmt(p.start)} - ${fmt(p.end)}</div>
                <div>${p.title}</div>
                ${p.desc ? `<div class="small text-muted">${p.desc.substring(0, 100)}</div>` : ""}
              </div>
            `);
    });
  }

  getVisibleProgramsForToday(chId) {
    const progs = this.schedule[chId] || [];
    if (!progs.length) return [];
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const todayProgs = progs.filter((p) => p.start < dayEnd && p.end >= dayStart);
    if (!todayProgs.length) return [];
    const past = todayProgs.filter((p) => p.end < Date.now());
    const currentAndFuture = todayProgs.filter((p) => p.end >= Date.now());
    const lastPast = past.length ? [past[past.length - 1]] : [];
    return [...lastPast, ...currentAndFuture].sort((a, b) => a.start - b.start);
  }

  jumpChannel(dir) {
    const cnt = this.categoryChannels.length;
    if (cnt === 0) return;
    const currentChannel = this.channels[this.currentChannelIndex];
    let idx = this.categoryChannels.indexOf(currentChannel);
    if (idx < 0) idx = 0;
    idx += dir;
    if (idx < 0) idx = cnt - 1;
    if (idx >= cnt) idx = 0;
    const ch = this.categoryChannels[idx];
    const realIdx = this.channels.indexOf(ch);
    this.playChannel(realIdx);
  }

  stopPlayer() {
    const video = document.getElementById("video");
    if (document.pictureInPictureElement && document.exitPictureInPicture) {
      document.exitPictureInPicture().catch(() => { });
    }
    if (video && video.webkitPresentationMode === "picture-in-picture") {
      try {
        video.webkitSetPresentationMode("inline");
      } catch (e) { }
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (video) {
      this.cleanupVideoElement();
    }
    $("#btn-pip").removeClass("active");
    this.showLoader(false);
    if (this.isCasting()) {
      this.stopCast();
    }
  }

  toggleFullscreen() {
    const video = document.getElementById("video");
    if (!document.fullscreenElement) {
      const fs = video.requestFullscreen || video.webkitRequestFullscreen || video.mozRequestFullScreen || video.msRequestFullscreen;
      if (fs) {
        fs.call(video).then(() => {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch(() => { });
          }
        }).catch(err => {
          this.toast("Fullscreen error: " + err.message, "danger");
        });
      }
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    }
  }

  togglePip() {
    const video = document.getElementById("video");
    if (!video || !video.currentSrc) {
      this.toast("Сначала запустите канал", "warning");
      return;
    }

    const hasStandardPip = !!(
      document.pictureInPictureEnabled &&
      typeof video.requestPictureInPicture === "function"
    );
    const hasWebkitPip = !!(
      typeof video.webkitSupportsPresentationMode === "function" &&
      video.webkitSupportsPresentationMode("picture-in-picture")
    );

    if (hasStandardPip) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch((err) => {
          this.toast("PiP error: " + err.message, "danger");
        });
        return;
      }

      const requestPip = () => {
        video.requestPictureInPicture().catch((err) => {
          this.toast("PiP error: " + err.message, "danger");
        });
      };

      if (video.readyState >= 1) {
        if (video.paused) {
          video.play().then(requestPip).catch(() => requestPip());
        } else {
          requestPip();
        }
      } else {
        video.addEventListener("loadedmetadata", () => {
          if (video.paused) {
            video.play().then(requestPip).catch(() => requestPip());
          } else {
            requestPip();
          }
        }, { once: true });
      }
      return;
    }

    if (hasWebkitPip) {
      try {
        const targetMode = video.webkitPresentationMode === "picture-in-picture"
          ? "inline"
          : "picture-in-picture";
        if (targetMode === "picture-in-picture" && video.paused) {
          video.play()
            .then(() => video.webkitSetPresentationMode(targetMode))
            .catch(() => video.webkitSetPresentationMode(targetMode));
        } else {
          video.webkitSetPresentationMode(targetMode);
        }
      } catch (err) {
        this.toast("PiP error: " + err.message, "danger");
      }
      return;
    }

    this.toast("На этом мобильном браузере PiP может не поддерживаться. Лучше всего работает в Safari (iPhone/iPad) или Chrome Android.", "warning");
  }

  initPipEvents() {
    const video = document.getElementById("video");
    if (!video || video.dataset.pipEventsBound === "true") return;
    video.addEventListener("enterpictureinpicture", () => {
      $("#btn-pip").addClass("active");
    });
    video.addEventListener("leavepictureinpicture", () => {
      $("#btn-pip").removeClass("active");
    });
    video.addEventListener("loadedmetadata", () => this.updatePipAvailability());
    video.addEventListener("emptied", () => {
      $("#btn-pip").removeClass("active");
      this.updatePipAvailability();
    });

    if ("onwebkitpresentationmodechanged" in video) {
      video.addEventListener("webkitpresentationmodechanged", () => {
        $("#btn-pip").toggleClass(
          "active",
          video.webkitPresentationMode === "picture-in-picture"
        );
      });
    }

    video.dataset.pipEventsBound = "true";
  }

  async copyText(text) {
    if (!text) {
      this.toast(this.t("lan_copy_fail"), "warning");
      return false;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temp = document.createElement("input");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }
      this.toast(this.t("lan_copy_ok"), "success");
      return true;
    } catch (e) {
      console.error("Copy error:", e);
      this.toast(this.t("lan_copy_fail"), "danger");
      return false;
    }
  }

  copyLanFieldValue(selector) {
    const value = $(selector).val();
    this.copyText(value);
  }

  getLanPlayerUrl() {
    const { protocol, hostname, port, pathname, search, hash } = window.location;
    if (!protocol.startsWith("http")) return "";
    let host = hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      host = window.location.hostname;
    }
    return `${protocol}//${host}${port ? `:${port}` : ""}${pathname}${search}${hash}`;
  }

  openLanStreamModal() {
    const ch = this.channels[this.currentChannelIndex];
    if (!ch?.url) {
      this.toast(this.t("lan_modal_no_channel"), "warning");
      return;
    }

    const playerUrl = this.getLanPlayerUrl();
    $("#lan-player-url").val(playerUrl || "");
    $("#lan-stream-url").val(ch.url || "");

    const help = $("#lan-player-help");
    if (playerUrl) {
      help.text("Откройте этот адрес на телевизоре/приставке в той же локальной сети.");
    } else {
      help.text("Если здесь пусто — запустите страницу через локальный HTTP сервер, а не через file://");
    }

    const modalEl = document.getElementById("lanStreamModal");
    if (modalEl) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }


  /* =========  Google Cast  ========= */
  initCast() {
    try {
      if (typeof cast === "undefined" || !cast.framework) return;
      const context = cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });
      context.addEventListener(
        cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (event) => {
          this.updateCastButtonUI(event.sessionState);
          if (event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
            event.sessionState === cast.framework.SessionState.SESSION_RESUMED) {
            this.loadCastMedia();
          }
        }
      );
    } catch (e) {
      console.error("Cast Init Error:", e);
    }
  }

  updateCastButtonUI(state) {
    const btn = $("#btn-cast");
    if (state === cast.framework.SessionState.SESSION_STARTED ||
      state === cast.framework.SessionState.SESSION_RESUMED) {
      btn.addClass("active-cast");
    } else {
      btn.removeClass("active-cast");
    }
  }

  isCasting() {
    if (typeof cast === "undefined" || !cast.framework) return false;
    const context = cast.framework.CastContext.getInstance();
    const session = context.getCurrentSession();
    return !!session;
  }

  toggleCast() {
    if (window.location.protocol === 'file:') {
      this.openLanStreamModal();
      this.toast("Открыт локальный LAN-режим без Google Cast и интернета.", "info");
      return;
    }

    if (window.location.protocol === 'file:') {
      this.toast("Внимание: Chromecast часто не работает при открытии файла напрямую (file://). Рекомендуется использовать локальный сервер или portable версию с HTTP.", "warning");
      // Не прерываем, вдруг в Electron/Neutralino проброшено
    }

    if (typeof cast === 'undefined' || !cast.framework) {
      this.openLanStreamModal();
      return this.toast("Cast SDK не загружен. Открыт локальный LAN-режим: можно передать ссылку на плеер или прямой поток без внешних сервисов.", "warning");
    }

    const context = cast.framework.CastContext.getInstance();
    context.requestSession().catch(err => {
      if (err !== 'cancel') {
        console.error("Cast error:", err);
        let msg = err;
        if (err === 'session_error') msg = "Ошибка сессии (Session Error). Проверьте, что ТВ в той же сети и поддерживает Google Cast.";
        if (err === 'channel_error') msg = "Ошибка канала связи с ТВ.";
        this.toast("Ошибка трансляции: " + msg, "danger");
      }
    });
  }

  loadCastMedia() {
    const session = cast.framework.CastContext.getInstance().getCurrentSession();
    if (!session) return;
    const ch = this.channels[this.currentChannelIndex];
    if (!ch) return;
    const mediaInfo = new chrome.cast.media.MediaInfo(ch.url, "application/x-mpegurl");
    const metadata = new chrome.cast.media.GenericMediaMetadata();
    metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
    metadata.title = ch.name;
    const epgChannelId = this.getEpgChannelId(ch);
    const prog = epgChannelId ? this.getCurrentProgram(epgChannelId) : null;
    if (prog) metadata.subtitle = prog.title;
    const icon = this.getChannelIcon(ch, epgChannelId);
    if (icon) metadata.images = [{ url: icon }];
    mediaInfo.metadata = metadata;
    mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;
    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    session.loadMedia(request).then(
      () => {
        console.log("Cast load success");
        document.getElementById("video").pause();
        this.toast(this.t("btn_cast") + ": " + ch.name, "success");
      },
      (errorCode) => {
        console.error("Cast load error:", errorCode);
        this.toast("Ошибка загрузки на ТВ: " + errorCode, "danger");
      }
    );
  }

  stopCast() {
    const context = cast.framework.CastContext.getInstance();
    const session = context.getCurrentSession();
    if (session) {
      session.endSession(true);
    }
  }

  /* =========  History & Utils  ========= */
  renderRecent() {
    const grid = $("#recent-grid");
    if (!grid.length) return;
    if (this.history.length === 0) {
      $("#recent-channels-block").hide();
      return;
    }
    $("#recent-channels-block").show();
    grid.empty();
    this.history.forEach((h) => {
      const card = $(`
          <div class="col-6 col-md-3">
            <div class="glass card-hover p-2 channel-card d-flex align-items-center" style="cursor:pointer;" tabindex="0">
              <div class="channel-logo-mini me-2 d-flex align-items-center justify-content-center">
                ${h.logo ? `<img src="${h.logo}" style="max-width:30px; max-height:30px;" loading="lazy">` : "<i class=\"fas fa-tv small text-muted\"></i>"}
              </div>
              <div class="card-title mb-0 small text-truncate">${h.name}</div>
            </div>
          </div>`);
      card.on("click", () => {
        const idx = this.channels.findIndex(c => c.name === h.name);
        if (idx >= 0) {
          this.playChannel(idx);
        } else {
          this.toast("Канал не найден в текущем списке", "warning");
        }
      });
      grid.append(card);
    });

    this.refreshTvFocusable();
  }

  getCategoryIcon(cat) {
    const c = cat.toLowerCase();
    if (c.includes("кино") || c.includes("movie") || c.includes("film")) return "fa-film";
    if (c.includes("спорт") || c.includes("sport")) return "fa-volleyball-ball";
    if (c.includes("детск") || c.includes("kids") || c.includes("мульт")) return "fa-child";
    if (c.includes("музык") || c.includes("music")) return "fa-music";
    if (c.includes("новост") || c.includes("news")) return "fa-newspaper";
    if (c.includes("научн") || c.includes("doc") || c.includes("познават")) return "fa-microscope";
    if (c.includes("развлекат") || c.includes("show")) return "fa-grin-stars";
    if (c.includes("hd") || c.includes("4k")) return "fa-gem";
    if (c.includes("эфир") || c.includes("обществ")) return "fa-broadcast-tower";
    return "fa-folder-open";
  }

  showLoader(show) {
    $("#global-loader").toggle(show !== false);
  }

  toast(msg, type = "info") {
    const toast = $(`<div class="toast align-items-center text-white bg-${type} border-0 position-fixed bottom-0 end-0 m-3" role="alert" style="z-index: 9999;">
            <div class="d-flex">
              <div class="toast-body">${msg}</div>
              <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
          </div>`);
    $("body").append(toast);
    const bsToast = new bootstrap.Toast(toast[0]);
    bsToast.show();
    setTimeout(() => toast.remove(), 3000);
  }
}

// Start
window.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});











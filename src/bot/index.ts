import { Bot } from "grammy";
import { setupNickSearch } from "./nickSearch.js";
import { setupPhoneSearch } from "./phoneSearch.js";
import { setupPhotoSearch } from "./photoSearch.js";
import { setupDeepSearch } from "./deepSearch.js";
import { setupIpSearch } from "./ipSearch.js";
import { setupIpLogger } from "./ipLogger.js";
import { setupEmailSearch } from "./emailSearch.js";
import { setupDomainSearch } from "./domainSearch.js";
import { setupCryptoSearch } from "./cryptoSearch.js";

export async function setupBot() {
  const token = process.env.BOT_TOKEN || "8597293888:AAGllUMlZCPYOjcy6BkHJTJLd3cEivVKW08"; 
  if (!token) {
    console.warn("BOT_TOKEN is missing. Bot is not starting.");
    return;
  }

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const welcome = `👁 <b>ПРОФЕССИОНАЛЬНЫЙ OSINT ИНСТРУМЕНТ</b> 👁\n\n` +
      `Главный пульт управления:\n\n` +
      `👤 <b>СОЦИАЛЬНАЯ РАЗВЕДКА</b>\n` +
      `├ /deep <никнейм>  — Многопоточный анализ (Все платформы)\n` +
      `├ /email <адрес>   — Проверка почты (Утечки, базы, dorks)\n` +
      `├ /phone <номер>   — Теневой анализ номера (Теги, соцсети)\n` +
      `└ /search_nick     — Быстрый чек ника (Лайт-версия)\n\n` +
      `🌐 <b>СЕТЬ И АППАРАТУРА</b>\n` +
      `├ /ip <адрес>      — Геолокация, провайдер, VPN детект\n` +
      `├ /iplogger        — Создать ловушку (Скрытый сбор данных о девайсе)\n` +
      `└ /domain <домен>  — Whois, Архивы, Файлы сайта\n\n` +
      `💰 <b>ФИНАНСЫ И ПОИСК</b>\n` +
      `├ /crypto <адрес>   — Анализ BTC/ETH транзакций на Даркнет\n` +
      `└ /search_photo     — Обратный поиск по лицу (FR, веб)\n\n` +
      `⚠️ <b>Важно:</b> Бот использует огромный арсенал OSINT Dorks и API агрегаторов, предоставляя самую глубокую информацию в открытом доступе.`;
    await ctx.reply(welcome, { parse_mode: "HTML" });
  });

  setupNickSearch(bot);
  setupPhoneSearch(bot);
  setupPhotoSearch(bot);
  setupDeepSearch(bot);
  setupIpSearch(bot);
  setupIpLogger(bot);
  setupEmailSearch(bot);
  setupDomainSearch(bot);
  setupCryptoSearch(bot);

  bot.catch((err) => {
    console.error("Error in bot:", err);
  });

  console.log("Starting Telegram Bot (Polling)...");
  
  await bot.api.setMyCommands([
    { command: "start", description: "Запустить / Главное меню" },
    { command: "deep", description: "🔍 Мощный сбор по никнейму" },
    { command: "phone", description: "📱 Анализ номера телефона" },
    { command: "email", description: "📧 Поиск по email почте" },
    { command: "ip", description: "🌐 Пробить IP адрес" },
    { command: "iplogger", description: "🔗 Создать ссылку-ловушку" },
    { command: "crypto", description: "💰 Транзакции блокчейна" },
    { command: "domain", description: "🌍 Анализ домена/сайта" },
    { command: "search_photo", description: "🖼 Обратный поиск по фото" },
  ]);

  bot.start({
    drop_pending_updates: true,
  });
  
  const ownerId = process.env.OWNER_ID;
  if (ownerId && !isNaN(Number(ownerId))) {
    try {
        await bot.api.sendMessage(ownerId, "✅ Бот успешно запущен!\nВсе OSINT-модули готовы к работе.");
    } catch(e) {}
  }
}

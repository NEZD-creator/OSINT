import { Bot } from "grammy";
import { setupGodSearch } from "./godSearch.js";
import { setupIpLogger } from "./ipLogger.js";
import { setupPhotoSearch } from "./photoSearch.js"; // Kept because uploading an image requires separate handling

export async function setupBot() {
  const token = process.env.BOT_TOKEN || "8597293888:AAGllUMlZCPYOjcy6BkHJTJLd3cEivVKW08"; 
  if (!token) {
    console.warn("BOT_TOKEN is missing. Bot is not starting.");
    return;
  }

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const welcome = `👁 <b>ПРОФЕССИОНАЛЬНЫЙ OSINT ИНСТРУМЕНТ</b> 👁\n\n` +
      `Я — умная поисковая аналитическая система.\n\n` +
      `<b>КАК ПОЛЬЗОВАТЬСЯ:</b>\n` +
      `Просто отправьте мне <b>любые данные</b> текстом, и я найду всё что смогу:\n\n` +
      `👤 <b>Никнейм</b> (поиск по соцсетям, базам, github, tg)\n` +
      `📱 <b>Номер телефона</b> (авито, мессенджеры, теги)\n` +
      `📧 <b>Email</b> (базы утечек, дорк-скан)\n` +
      `🌐 <b>IP / Домен</b> (гео, провайдер, DNS, порты)\n` +
      `💰 <b>Криптокошелек</b> (BTC/ETH транзакции, графы)\n\n` +
      `Помимо этого, у меня есть особые утилиты:\n` +
      `├ /iplogger — Создать ссылку-ловушку для фиксации IP!\n` +
      `└ /search_photo — Обратный поиск по лицу/аватарке\n\n` +
      `Напишите мне любой запрос прямо сейчас:`;
    await ctx.reply(welcome, { parse_mode: "HTML" });
  });

  setupGodSearch(bot);
  setupIpLogger(bot);
  setupPhotoSearch(bot);

  bot.catch((err) => {
    console.error("Error in bot:", err);
  });

  console.log("Starting Telegram Bot (Polling)...");
  
  await bot.api.setMyCommands([
    { command: "start", description: "Запустить / Главное меню" },
    { command: "search", description: "🔍 Универсальный мощный поиск (или просто пишите текст)" },
    { command: "iplogger", description: "🔗 Создать ссылку-ловушку для IP" },
    { command: "search_photo", description: "🖼 Обратный поиск по фото" },
  ]);

  bot.start({
    drop_pending_updates: true,
  });
  
  const ownerId = process.env.OWNER_ID;
  if (ownerId && !isNaN(Number(ownerId))) {
    try {
        await bot.api.sendMessage(ownerId, "✅ Бот успешно запущен!\nOSINT-модули готовы к работе.");
    } catch(e) {}
  }
}


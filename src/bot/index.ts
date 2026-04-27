import { Bot } from "grammy";
import { setupNickSearch } from "./nickSearch.js";
import { setupPhoneSearch } from "./phoneSearch.js";
import { setupPhotoSearch } from "./photoSearch.js";

// Uses bot token from user prompt or environment logic
export async function setupBot() {
  const token = process.env.BOT_TOKEN || "8597293888:AAGllUMlZCPYOjcy6BkHJTJLd3cEivVKW08"; // fallback if .env is missing it
  if (!token) {
    console.warn("BOT_TOKEN is missing. Bot is not starting.");
    return;
  }

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const welcome = `Привет! Я OSINT-бот для исследования цифрового следа.\n\n` +
      `Доступные команды:\n` +
      `👤 /search_nick <никнейм> — поиск по открытым профилям\n` +
      `📱 /search_phone <телефон> — публичная инфо в Telegram\n` +
      `🖼 /search_photo — обратный поиск по лицу/фото\n\n` +
      `⚠️ Бот работает строго в правовом поле (152-ФЗ РФ, GDPR) и использует исключительно открытые источники информации.`;
    await ctx.reply(welcome);
  });

  setupNickSearch(bot);
  setupPhoneSearch(bot);
  setupPhotoSearch(bot);

  // Error handler
  bot.catch((err) => {
    console.error("Error in bot:", err);
  });

  console.log("Starting Telegram Bot (Polling)...");
  
  // Set bot commands to show up in the menu
  await bot.api.setMyCommands([
    { command: "start", description: "Запустить / перезапустить бота" },
    { command: "search_nick", description: "Поиск по никнейму (открытые профили)" },
    { command: "search_phone", description: "Поиск по номеру (Telegram)" },
    { command: "search_photo", description: "Обратный поиск по фото" },
  ]);

  // Use non-blocking start
  bot.start({
    drop_pending_updates: true,
  });
  
  const ownerId = process.env.OWNER_ID;
  if (ownerId && !isNaN(Number(ownerId))) {
    try {
        await bot.api.sendMessage(ownerId, "✅ Бот успешно запущен!\nВсе OSINT-модули готовы к работе на Node.js платформе.");
    } catch(e) {
        console.error("Failed to notify owner", e);
    }
  }
}

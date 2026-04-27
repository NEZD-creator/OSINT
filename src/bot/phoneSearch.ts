import { Bot } from "grammy";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const WARNING_MSG =
  "⚠️ Бот использует только открытые источники. Продолжая, вы подтверждаете, что " +
  "имеете право искать информацию об этом человеке и не нарушаете закон.";

const DISCLAIMER_MSG =
  "\n\nℹ️ <i>Данные взяты из открытых источников. Если вы владелец данных и " +
  "хотите удалить информацию, измените настройки приватности в Telegram: " +
  "Настройки -> Конфиденциальность -> Номер телефона.</i>";

export function setupPhoneSearch(bot: Bot) {
  bot.command("search_phone", async (ctx) => {
    const text = ctx.message?.text || "";
    const args = text.split(/\s+/);

    if (args.length < 2) {
      await ctx.reply("Использование: `/search_phone +1234567890`", { parse_mode: "Markdown" });
      return;
    }

    const phone = args[1].trim();
    const apiId = process.env.API_ID;
    const apiHash = process.env.API_HASH;

    if (!apiId || !apiHash) {
      await ctx.reply(
        "🤖 Внутренняя ошибка сервиса: Модуль поиска по номеру не настроен (отсутствуют API ключи Telegram)."
      );
      return;
    }

    await ctx.reply(WARNING_MSG);
    const statusMsg = await ctx.reply(`⏳ Проверяю телефон <code>${phone}</code> в Telegram...`, {
      parse_mode: "HTML",
    });

    try {
      // In JS, working with user sessions on the fly without saved tokens is tricky, 
      // we mock the unavailable logic because the bot doesn't have an active user session yet.
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `🤷‍♂️ Номер телефона требует активной user-сессии. Для полноценной проверки через GramJS необходимо авторизоваться `+
        `с использованием API_ID и API_HASH (и ввести код подтверждения).\n` +
        `Пожалуйста, настройте User-Session локально.` + DISCLAIMER_MSG,
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      console.error(err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `❌ Ошибка при проверке номера. Возможно, неверный формат. Попробуйте +79XXXXXXXXX.\n<i>Детали: ${err.message}</i>`,
        { parse_mode: "HTML" }
      );
    }
  });
}

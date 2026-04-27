import { Bot } from "grammy";

export function setupPhoneSearch(bot: Bot) {
  const handler = async (ctx: any) => {
    const args = (ctx.message?.text || "").split(/\s+/);
    if (args.length < 2) {
      await ctx.reply("Для поиска отправьте: `/phone +79998887766`", { parse_mode: "Markdown" });
      return;
    }

    const phone = args[1].trim().replace(/[^0-9+]/g, '');
    const statusMsg = await ctx.reply(`⏳ Выполняю кросс-поиск и агрегацию OSINT по номеру <b>${phone}</b>...`, { parse_mode: "HTML" });

    let cleanNumber = phone;
    if (phone.startsWith("+")) cleanNumber = phone.substring(1);
    
    let report = `📱 <b>OSINT Отчет по номеру:</b> <code>${phone}</code>\n\n`;

    report += `🌎 <b>Мессенджеры (Проверка открытого профиля по ссылке):</b>\n`;
    report += `└ <a href="https://t.me/+${cleanNumber}">Перейти в Telegram (Чат)</a>\n`;
    report += `└ <a href="https://wa.me/${cleanNumber}">Перейти в WhatsApp (Чат)</a>\n`;
    report += `└ <a href="viber://chat?number=${cleanNumber}">Перейти в Viber (Чат)</a>\n\n`;

    report += `👀 <b>Проверка в базах (Определители номеров):</b>\n`;
    report += `└ <a href="https://numbuster.com/ru/phone/+${cleanNumber}">Проверить теги в NumBuster</a>\n`;
    report += `└ <a href="https://www.truecaller.com/search/ru/${cleanNumber}">Искать пользователя в TrueCaller</a>\n`;
    report += `└ <a href="https://getcontact.com">Пробить через GetContact App</a>\n\n`;

    report += `🔍 <b>Продвинутый поиск скрытой информации (Dorks):</b>\n`;
    report += `└ <a href="https://www.google.com/search?q=%22${phone}%22+OR+%22${cleanNumber}%22">Точный поиск номера в интернете</a>\n`;
    report += `└ <a href="https://www.google.com/search?q=site:avito.ru+%22${cleanNumber}%22">Поиск объявлений (Avito)</a>\n`;
    report += `└ <a href="https://www.google.com/search?q=site:auto.ru+%22${cleanNumber}%22">Поиск автомобилей продавца (Auto.ru)</a>\n`;
    report += `└ <a href="https://www.google.com/search?q=ext:csv+OR+ext:sql+%22${cleanNumber}%22">Поиск логов и утекших баз</a>\n\n`;
    
    report += `ℹ️ <i>Бот агрегирует ссылки на легальные OSINT-площадки. Глубинный пробив (СДЭК, Яндекс.Еда) работает через них.</i>`;

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true }
    });
  };

  bot.command("search_phone", handler);
  bot.command("phone", handler);
}

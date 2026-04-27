import { Bot } from "grammy";

export function setupEmailSearch(bot: Bot) {
  bot.command("email", async (ctx) => {
    const args = (ctx.message?.text || "").split(/\s+/);
    if (args.length < 2) {
      await ctx.reply("Использование: `/email <адрес>` - проверка почты в цифровом следе", { parse_mode: "Markdown" });
      return;
    }

    const email = args[1].trim();
    const statusMsg = await ctx.reply(`⏳ Анализирую email: <code>${email}</code>...`, { parse_mode: "HTML" });

    let report = `📧 <b>Отчет по email:</b> <code>${email}</code>\n\n`;

    const parts = email.split('@');
    if (parts.length === 2) {
        const user = parts[0];
        const domain = parts[1];

        report += `🔍 <b>Google Dorks (Поиск упоминаний и документов):</b>\n`;
        report += `└ <a href="https://www.google.com/search?q=%22${email}%22">Все упоминания email в сети</a>\n`;
        report += `└ <a href="https://www.google.com/search?q=%22${user}%22+site:${domain}">Поиск профилей на родном домене</a>\n`;
        report += `└ <a href="https://www.google.com/search?q=ext:txt+OR+ext:sql+OR+ext:csv+OR+ext:log+%22${email}%22">Поиск в логах и дампах (txt/sql)</a>\n\n`;
    }

    report += `🕵️‍♂️ <b>Публичные базы компрометации:</b>\n`;
    report += `└ <a href="https://haveibeenpwned.com/account/${email}">Have I Been Pwned (База утечек)</a>\n`;
    report += `└ <a href="https://emailrep.io/${email}">EmailRep.io (Репутация и соцсети)</a>\n\n`;

    report += `ℹ️ <i>Бот не распространяет пароли и ПДн из закрытых утекших баз напрямую, мы используем легальные OSINT-агрегаторы для нахождения источников.</i>`;

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true }
    });
  });
}

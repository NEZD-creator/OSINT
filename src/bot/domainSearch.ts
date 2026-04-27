import { Bot } from "grammy";

export function setupDomainSearch(bot: Bot) {
  bot.command("domain", async (ctx) => {
    const args = (ctx.message?.text || "").split(/\s+/);
    if (args.length < 2) {
      await ctx.reply("Использование: `/domain <домен>` - анализ домена/сайта (DNS, IPs)", { parse_mode: "Markdown" });
      return;
    }

    const domain = args[1].trim();
    const statusMsg = await ctx.reply(`⏳ Собираю OSINT по домену: <code>${domain}</code>...`, { parse_mode: "HTML" });

    try {
        let report = `🌐 <b>Отчет по домену:</b> <code>${domain}</code>\n\n`;
        
        // IP Resolution
        const ipRes = await fetch(`http://ip-api.com/json/${domain}?fields=status,query,country,isp,org`);
        if (ipRes.status === 200) {
            const data: any = await ipRes.json();
            if (data.status === "success") {
                report += `📌 <b>IP Адрес сервера:</b> <code>${data.query}</code>\n`;
                report += `📍 <b>Хостинг/Провайдер:</b> ${data.country}, ${data.isp} (${data.org})\n\n`;
            }
        }

        report += `🕰 <b>Машина Времени (Архив сайта):</b>\n`;
        report += `└ <a href="https://web.archive.org/web/*/${domain}">Смотреть старые версии сайта на Wayback Machine</a>\n\n`;

        report += `🔍 <b>Поиск скрытых директорий и файлов (Dorks):</b>\n`;
        report += `└ <a href="https://www.google.com/search?q=site:${domain}+filetype:pdf+OR+filetype:doc+OR+filetype:xls+OR+filetype:csv">Публичные документы, отчеты, таблицы</a>\n`;
        report += `└ <a href="https://www.google.com/search?q=site:${domain}+intitle:%22index+of%22">Открытые папки (Index of)</a>\n`;
        report += `└ <a href="https://www.google.com/search?q=site:${domain}+inurl:admin+OR+inurl:login">Поиск админ-панелей</a>\n\n`;

        report += `🛡 <b>Анализ безопасности:</b>\n`;
        report += `└ <a href="https://securitytrails.com/domain/${domain}/dns">SecurityTrails (DNS история)</a>\n`;
        report += `└ <a href="https://crt.sh/?q=${domain}">crt.sh (Сертификаты и поддомены)</a>\n\n`;

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true }
        });
    } catch (e) {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Ошибка при анализе домена.`, { parse_mode: "HTML" });
    }
  });
}

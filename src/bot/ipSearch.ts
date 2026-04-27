import { Bot } from "grammy";

export function setupIpSearch(bot: Bot) {
  bot.command("ip", async (ctx) => {
    const args = (ctx.message?.text || "").split(/\s+/);
    if (args.length < 2) {
      await ctx.reply("Использование: `/ip <айпи адрес>` - узнать всё об IP-адресе (провайдер, локация, VPN/Proxy)", { parse_mode: "Markdown" });
      return;
    }

    const ip = args[1].trim();
    const statusMsg = await ctx.reply(`⏳ Проверяю IP-адрес: <code>${ip}</code>...`, { parse_mode: "HTML" });

    try {
      // Use ip-api.com, it allows up to 45 requests per minute, no API key required for HTTP
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,mobile,query`);
      if (res.status === 200) {
        const data: any = await res.json();
        
        if (data.status === "success") {
          let report = `🌐 <b>Отчет по IP-адресу:</b> <code>${data.query}</code>\n\n`;
          report += `📍 <b>Локация:</b> ${data.country}, ${data.regionName}, ${data.city} (Код: ${data.zip || "Нет"})\n`;
          report += `🗺 <b>Координаты:</b> <code>${data.lat}, ${data.lon}</code>\n`;
          report += `🕒 <b>Часовой пояс:</b> ${data.timezone}\n\n`;
          
          report += `🏢 <b>Провайдер (ISP):</b> ${data.isp}\n`;
          report += `🏭 <b>Организация:</b> ${data.org || data.isp}\n`;
          report += `📡 <b>AS:</b> ${data.as}\n\n`;
          
          report += `🛡 <b>Анализ сети:</b>\n`;
          report += `├ 📱 Мобильный интернет: ${data.mobile ? "✅ Да" : "❌ Нет"}\n`;
          report += `├ 💻 Сервер/Хостинг: ${data.hosting ? "✅ Да (Возможно VPN)" : "❌ Нет"}\n`;
          report += `└ 🎭 Proxy/VPN: ${data.proxy ? "✅ Обнаружен!" : "❌ Не обнаружен"}\n\n`;
          
          report += `🔗 <a href="https://www.google.com/maps?q=${data.lat},${data.lon}">Посмотреть на карте (Google Maps)</a>`;

          await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true }
          });
        } else {
          await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Ошибка: Неверный формат IP-адреса или приватный адрес.\n<i>Ответ: ${data.message}</i>`, { parse_mode: "HTML" });
        }
      } else {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Ошибка API при проверке IP.`);
      }
    } catch (e) {
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Ошибка сети при запросе.`);
    }
  });
}

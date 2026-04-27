import { Bot } from "grammy";
import * as cheerio from "cheerio";

const WARNING_MSG =
  "⚠️ Бот использует только открытые источники. Продолжая, вы подтверждаете, что " +
  "имеете право искать информацию об этом человеке (исследование собственного " +
  "цифрового следа, журналистское расследование и т.п.) и не нарушаете закон.";

const DISCLAIMER_MSG =
  "\n\nℹ️ <i>Данные взяты из открытых источников. Если вы владелец данных и " +
  "хотите удалить информацию, обратитесь к администратору соответствующего сайта.</i>";

const SITES = [
  { name: "GitHub", url: "https://github.com/{}" },
  { name: "Telegram", url: "https://t.me/{}" },
  { name: "Reddit", url: "https://www.reddit.com/user/{}" },
  { name: "SoundCloud", url: "https://soundcloud.com/{}" },
  { name: "Vimeo", url: "https://vimeo.com/{}" },
  { name: "Patreon", url: "https://www.patreon.com/{}" },
  { name: "Twitch", url: "https://www.twitch.tv/{}" },
  { name: "VK", url: "https://vk.com/{}" },
  { name: "Dev.to", url: "https://dev.to/{}" },
  { name: "Behance", url: "https://www.behance.net/{}" },
  { name: "Medium", url: "https://medium.com/@{}" },
];

export function setupNickSearch(bot: Bot) {
  bot.command("search_nick", async (ctx) => {
    const text = ctx.message?.text || "";
    const args = text.split(/\s+/);

    if (args.length < 2) {
      await ctx.reply("Использование: `/search_nick <никнейм>`", { parse_mode: "Markdown" });
      return;
    }

    const nickname = args[1].trim();
    await ctx.reply(WARNING_MSG);

    const statusMsg = await ctx.reply(`⏳ Ищу данные открытого профиля: <b>${nickname}</b>...\nОценка времени: ~${SITES.length} сек.`, {
      parse_mode: "HTML",
    });

    const results: string[] = [];

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
    };

    for (const site of SITES) {
      const targetUrl = site.url.replace("{}", nickname);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(targetUrl, {
          method: "GET",
          headers,
          signal: controller.signal as any,
          redirect: "follow",
        });
        
        clearTimeout(timeoutId);

        if (response.status === 200) {
          const html = await response.text();
          const $ = cheerio.load(html);
          const title = $("title").text().trim() || "Без заголовка";

          const lowerTitle = title.toLowerCase();
          const notFoundMarkers = [
            "not found", "404", "такой страницы нет", "ошибка", "page does not exist", "suspended",
          ];

          const isNotFound = notFoundMarkers.some((marker) => lowerTitle.includes(marker));
          if (!isNotFound) {
            results.push(`✅ <b>${site.name}</b>\n   🔗 <a href="${targetUrl}">${targetUrl}</a>\n   📝 <i>${title}</i>`);
          }
        }
      } catch (err) {
        // Silently ignore Fetch timeouts
      }

      // Delay 1s to be polite
      await new Promise((r) => setTimeout(r, 1000));
    }

    let responseText = "";
    if (results.length > 0) {
      responseText = `<b>🔎 Найденные упоминания (${results.length}):</b>\n\n` + results.join("\n\n");
    } else {
      responseText = "🤷‍♂️ Профили не найдены или закрыты настройками приватности.";
    }

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, responseText + DISCLAIMER_MSG, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });
}

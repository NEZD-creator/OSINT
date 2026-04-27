import { Bot } from "grammy";
import * as cheerio from "cheerio";
import FormData from "form-data";

const DISCLAIMER_MSG =
  "\n\nℹ️ <i>Данные получены исключительно из открытых источников и публичных профилей без использования утекших баз. " +
  "Найти скрытую информацию (например, телефон без привязки в профиле) легальными методами невозможно.</i>";

async function uploadToTelegraphFromUrl(imgUrl: string): Promise<string | null> {
    try {
        const res = await fetch(imgUrl);
        const buffer = await res.arrayBuffer();
        
        const form = new FormData();
        form.append('file', Buffer.from(buffer), { filename: 'image.jpg', contentType: 'image/jpeg' });
        
        const uploadRes = await fetch('https://telegra.ph/upload', {
            method: 'POST',
            body: form as any
        });
        const json: any = await uploadRes.json();
        if (json && json[0] && json[0].src) {
            return `https://telegra.ph${json[0].src}`;
        }
    } catch (e) {
        console.error("Telegraph upload error", e);
    }
    return null;
}

const SITES = [
  { name: "GitHub", url: "https://github.com/{}" },
  { name: "Reddit", url: "https://www.reddit.com/user/{}" },
  { name: "VK", url: "https://vk.com/{}" },
  { name: "Habr", url: "https://habr.com/ru/users/{}/" },
  { name: "SoundCloud", url: "https://soundcloud.com/{}" },
  { name: "Patreon", url: "https://www.patreon.com/{}" },
  { name: "Twitch", url: "https://www.twitch.tv/{}" },
  { name: "Dev.to", url: "https://dev.to/{}" }
];

export function setupDeepSearch(bot: Bot) {
  bot.command("deep", async (ctx) => {
    const args = (ctx.message?.text || "").split(/\s+/);
    if (args.length < 2) {
      await ctx.reply("Использование: `/deep <никнейм>` - полный легальный сбор инфы (Tg, GitHub, соцсети, фото)", { parse_mode: "Markdown" });
      return;
    }

    const nickname = args[1].trim();
    const statusMsg = await ctx.reply(`⏳ Начинаю глубокий сбор данных по <b>${nickname}</b>...\n<i>Это может занять 10-15 секунд, так как бот парсит множество сайтов и фото.</i>`, { parse_mode: "HTML" });

    let report = `🕵️‍♂️ <b>Глубокий анализ по нику:</b> <code>${nickname}</code>\n\n`;

    // 1. Telegram Web parse (The Only 100% legal way without bot being blocked by user privacy)
    let tgPhotoUrl = null;
    let tgBio = null;
    try {
        const tgRes = await fetch(`https://t.me/${nickname}`);
        if (tgRes.status === 200) {
            const tgHtml = await tgRes.text();
            const $ = cheerio.load(tgHtml);
            const tgName = $(".tgme_page_title").text().trim();
            tgBio = $(".tgme_page_description").text().trim();
            const photoEl = $(".tgme_page_photo_image").attr('src');
            
            if (tgName || tgBio) {
                report += `✈️ <b>Telegram профиль (@${nickname}):</b>\n`;
                if (tgName) report += `👤 <b>Имя:</b> ${tgName}\n`;
                if (tgBio) {
                    report += `💬 <b>Био:</b> <i>${tgBio}</i>\n`;
                    // Parse Phones from bio
                    const phones = tgBio.match(/(?:\+|\d)[\d\-\(\) ]{9,16}\d/g);
                    if (phones) {
                        report += `📞 <b>Найдены телефоны в био:</b> <code>${phones.join(", ")}</code>\n`;
                    } else {
                        report += `📞 <b>Телефон:</b> <i>Скрыт настройками или отсутствует (легально недоступен)</i>\n`;
                    }
                    // Parse secondary usernames
                    const otherNicks = tgBio.match(/@[a-zA-Z0-9_]+/g);
                    if (otherNicks) {
                        const filtered = otherNicks.filter(n => n.toLowerCase() !== `@${nickname.toLowerCase()}`);
                        if (filtered.length > 0) {
                            report += `👥 <b>Связанные аккаунты из био:</b> ${filtered.join(", ")}\n`;
                        } else {
                            report += `👥 <b>Другие аккаунты:</b> <i>Не указаны</i>\n`;
                        }
                    }
                }
                
                if (photoEl && !photoEl.includes('default')) {
                    tgPhotoUrl = photoEl;
                    report += `🖼 <b>Аватарка:</b> Найдена! (готовится обратный поиск...)\n`;
                }
                report += `\n`;
            } else {
                report += `✈️ <i>Telegram аккаунт не найден или полностью пуст.</i>\n\n`;
            }
        }
    } catch (e) {
        console.error("TG scrape failed", e);
    }

    // 2. Search other sites concurrently
    report += `🌍 <b>Присутствие на других платформах:</b>\n`;
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0.0.0 Safari/537.36"
    };

    const sitePromises = SITES.map(async site => {
       const url = site.url.replace("{}", nickname);
       try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(url, { headers, signal: controller.signal as any });
          clearTimeout(timeout);
          if (res.status === 200) {
             const html = await res.text();
             const $ = cheerio.load(html);
             const title = $("title").text().trim().toLowerCase();
             
             // Soft 404 filtering
             if (!["not found", "404", "ошибка", "does not exist", "suspended"].some(m => title.includes(m))) {
                return `✅ <a href="${url}">${site.name}</a>`;
             }
          }
       } catch (e) {}
       return null;
    });

    const siteResults = await Promise.all(sitePromises);
    const validSites = siteResults.filter(r => r !== null);
    if (validSites.length > 0) {
        report += validSites.join("\n") + "\n\n";
    } else {
        report += `<i>Не найдено (или закрыто настройками приватности).</i>\n\n`;
    }

    // 3. Photo Reverse Search
    if (tgPhotoUrl) {
       report += `🔍 <b>Обратный поиск по аватару:</b>\n`;
       const telegraPhUrl = await uploadToTelegraphFromUrl(tgPhotoUrl);
       if (telegraPhUrl) {
           const enc = encodeURIComponent(telegraPhUrl);
           report += `🔗 <a href="https://lens.google.com/uploadbyurl?url=${enc}">Искать в Google Lens</a>\n`;
           report += `🔗 <a href="https://yandex.ru/images/search?rpt=imageview&url=${enc}">Искать в Яндекс Картинках</a>\n`;
       } else {
           report += `<i>Не удалось обработать аватар для обратного поиска.</i>\n`;
       }
    }

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report + DISCLAIMER_MSG, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
    });
  });
}

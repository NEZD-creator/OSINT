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
  { name: "Reddit", url: "https://www.reddit.com/user/{}", notFound: ["page not found", "looks like this page", "does not exist"] },
  { name: "YouTube", url: "https://www.youtube.com/@{}", notFound: ["404 not found", "не найдена", "isn't available", "error 404"] },
  { name: "VK", url: "https://vk.com/{}", notFound: ["страница не найдена", "page not found"] },
  { name: "Habr", url: "https://habr.com/ru/users/{}/", notFound: ["пользователь не найден", "404", "error"] },
  { name: "SoundCloud", url: "https://soundcloud.com/{}", notFound: ["we can't find that user", "not found"] },
  { name: "Steam", url: "https://steamcommunity.com/id/{}", notFound: ["the specified profile could not be found", "error"] },
  { name: "Patreon", url: "https://www.patreon.com/{}", notFound: ["404", "not found"] },
  { name: "Twitch", url: "https://www.twitch.tv/{}", notFound: ["sorry. unless you've got a time machine"] },
  { name: "Dev.to", url: "https://dev.to/{}", notFound: ["this page does not exist"] },
  { name: "Medium", url: "https://medium.com/@{}", notFound: ["out of nothing", "404", "error 404", "user not found"] },
  { name: "Vimeo", url: "https://vimeo.com/{}", notFound: ["page not found", "404"] },
  { name: "Keybase", url: "https://keybase.io/{}", notFound: ["not found", "doesn't exist"] },
  { name: "Pinterest", url: "https://www.pinterest.com/{}/", notFound: ["not found", "doesn't exist"] },
  { name: "Pikabu", url: "https://pikabu.ru/@{}", notFound: ["ошибка 404", "не найдена"] },
];

export function setupDeepSearch(bot: Bot) {
  bot.command("deep", async (ctx) => {
    const args = (ctx.message?.text || "").split(/\s+/);
    if (args.length < 2) {
      await ctx.reply("Использование: `/deep <никнейм>` - полный легальный сбор инфы (Tg, API, соцсети, фото)", { parse_mode: "Markdown" });
      return;
    }

    const nickname = args[1].trim();
    const statusMsg = await ctx.reply(`⏳ Начинаю глубокий сбор данных по <b>${nickname}</b>...\n<i>Это может занять ~15 секунд. Парсим публичные API, Telegram, соцсети и аватары.</i>`, { parse_mode: "HTML" });

    let report = `🕵️‍♂️ <b>Глубокий анализ по нику:</b> <code>${nickname}</code>\n\n`;

    // 1. Telegram Web parse
    let tgPhotoUrl = null;
    try {
        const tgRes = await fetch(`https://t.me/${nickname}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0" }
        });
        if (tgRes.status === 200) {
            const tgHtml = await tgRes.text();
            const $ = cheerio.load(tgHtml);
            const tgName = $(".tgme_page_title").text().trim();
            const tgBio = $(".tgme_page_description").text().trim();
            const photoEl = $(".tgme_page_photo_image").attr('src');
            
            if (tgName || tgBio) {
                report += `✈️ <b>Telegram профиль (@${nickname}):</b>\n`;
                if (tgName) report += `👤 <b>Имя:</b> ${tgName}\n`;
                if (tgBio) {
                    report += `💬 <b>Био:</b> <i>${tgBio}</i>\n`;
                    // Parse Phones from bio
                    const phones = tgBio.match(/(?:\+|\d)[\d\-\(\) ]{9,16}\d/g);
                    if (phones) {
                        report += `📞 <b>Найдены телефоны в био:</b> <code>${phones.map(p=>p.trim()).join(", ")}</code>\n`;
                    }
                    // Parse links / other nicks
                    const otherNicks = tgBio.match(/@[a-zA-Z0-9_]+/g);
                    if (otherNicks) {
                        const filtered = otherNicks.filter(n => n.toLowerCase() !== `@${nickname.toLowerCase()}`);
                        if (filtered.length > 0) report += `👥 <b>Упоминания аккаунтов:</b> ${filtered.join(", ")}\n`;
                    }
                    const links = tgBio.match(/https?:\/\/[^\s]+/g);
                    if (links) {
                        report += `🔗 <b>Ссылки в био:</b> ${links.join(" ")}\n`;
                    }
                }
                
                if (photoEl && !photoEl.includes('default')) {
                    tgPhotoUrl = photoEl;
                    report += `🖼 <b>Аватарка:</b> Найдена (сохранена для обратного поиска)\n`;
                }
                report += `\n`;
            } else {
                report += `✈️ <i>Telegram аккаунт не найден (или нет публичного имени/био).</i>\n\n`;
            }
        }
    } catch (e) {
        console.error("TG scrape failed", e);
    }

    // 2. Open APIs Data Extraction (GitHub, Chess.com, HackerNews)
    report += `📡 <b>Публичные базы и API:</b>\n`;
    let apiHits = 0;
    
    // GitHub API
    try {
        const ghRes = await fetch(`https://api.github.com/users/${nickname}`, { headers: { "User-Agent": "OSINT-Bot" }});
        if (ghRes.status === 200) {
            const ghData: any = await ghRes.json();
            report += `✅ <b>GitHub</b>:\n`;
            if (ghData.name) report += `  ├ 👤 Имя: ${ghData.name}\n`;
            if (ghData.company) report += `  ├ 🏢 Компания: ${ghData.company}\n`;
            if (ghData.blog) report += `  ├ 🔗 Сайт: ${ghData.blog}\n`;
            if (ghData.location) report += `  ├ 📍 Локация: ${ghData.location}\n`;
            if (ghData.email) report += `  ├ 📧 Email: ${ghData.email}\n`;
            if (ghData.twitter_username) report += `  ├ 🐦 Twitter: @${ghData.twitter_username}\n`;
            if (ghData.bio) report += `  └ 📝 Био: ${ghData.bio.replace(/\n/g, " ")}\n`;
            apiHits++;
            
            if (!tgPhotoUrl && ghData.avatar_url) {
                tgPhotoUrl = ghData.avatar_url; // Use GH avatar for reverse search if none from TG
            }
        }
    } catch (e) {}

    // Chess.com API
    try {
        const chessRes = await fetch(`https://api.chess.com/pub/player/${nickname}`, { headers: { "User-Agent": "OSINT-Bot" }});
        if (chessRes.status === 200) {
            const chessData: any = await chessRes.json();
            report += `✅ <b>Chess.com</b>:\n`;
            if (chessData.name) report += `  ├ 👤 Имя: ${chessData.name}\n`;
            if (chessData.location) report += `  └ 📍 Локация: ${chessData.location}\n`;
            apiHits++;
        }
    } catch (e) {}

    // HackerNews
    try {
        const hnRes = await fetch(`https://hacker-news.firebaseio.com/v0/user/${nickname}.json`);
        if (hnRes.status === 200) {
            const hnData: any = await hnRes.json();
            if (hnData && hnData.created) {
                report += `✅ <b>HackerNews</b>:\n`;
                report += `  ├ 📅 Дата регистрации: ${new Date(hnData.created * 1000).toLocaleDateString()}\n`;
                report += `  └ ⭐️ Карма: ${hnData.karma}\n`;
                apiHits++;
            }
        }
    } catch (e) {}
    
    if (apiHits === 0) report += `<i>В базах разработчиков/игроков профиль не найден.</i>\n`;
    report += `\n`;

    // 3. Search other sites concurrently via HTML scrape
    report += `🌍 <b>Обычные сайты и платформы:</b>\n`;
    const headers = { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
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
             const bodyShort = $("body").text().toLowerCase().substring(0, 3000);
             
             // Check custom block terms
             const notFoundMarkers = site.notFound || ["not found", "404", "ошибка"];
             const isNotFound = notFoundMarkers.some(m => title.includes(m) || bodyShort.includes(m));
             
             if (!isNotFound && !res.url.includes("login") && !res.url.includes("error")) {
                return `🔹 <a href="${url}">${site.name}</a>`;
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
        report += `<i>Не найдено или скрыто страницами 404.</i>\n\n`;
    }

    // 4. Photo Reverse Search
    if (tgPhotoUrl) {
       report += `🔍 <b>Обратный поиск по аватару:</b>\n`;
       const telegraPhUrl = await uploadToTelegraphFromUrl(tgPhotoUrl);
       if (telegraPhUrl) {
           const enc = encodeURIComponent(telegraPhUrl);
           report += `🔗 <a href="https://lens.google.com/uploadbyurl?url=${enc}">Искать лицо в Google Lens</a>\n`;
           report += `🔗 <a href="https://yandex.ru/images/search?rpt=imageview&url=${enc}">Искать лицо в Яндекс.Картинках</a>\n`;
       } else {
           report += `<i>Не удалось загрузить аватар для генерации ссылок.</i>\n`;
       }
    }
    
    // 5. Google Dorks (Advanced OSINT)
    report += `\n🧠 <b>Продвинутый поиск в Google (Dorks):</b>\n`;
    report += `└ <a href="https://www.google.com/search?q=%22${nickname}%22+OR+intitle:%22${nickname}%22">Общий поиск по точному совпадению</a>\n`;
    report += `└ <a href="https://www.google.com/search?q=ext:doc+OR+ext:pdf+OR+ext:txt+%22${nickname}%22">Поиск утекших документов и логов</a>\n`;
    report += `└ <a href="https://www.google.com/search?q=site:telegra.ph+%22${nickname}%22">Поиск статей на Telegraph</a>\n\n`;

    try {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report + DISCLAIMER_MSG, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
        });
    } catch(e) {
        // If message is too long, we split or just fallback
        await ctx.reply(report + DISCLAIMER_MSG, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true }
        });
    }
  });
}


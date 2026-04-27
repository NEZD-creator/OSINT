import { Bot, Context } from "grammy";
import FormData from "form-data";

const WARNING_MSG =
  "⚠️ Бот использует только открытые источники. Продолжая, вы подтверждаете, что " +
  "имеете право искать объекты/людей на этом фото (исследование цифрового следа) и не нарушаете закон.";

const DISCLAIMER_MSG =
  "\n\nℹ️ <i>Мы не храним переданные фотографии (обработка в ОЗУ). Прямые ссылки сгенерированы для безопасного поиска через ваш браузер.</i>";

// Simple in-memory state (instead of full FSM plugin to keep dependencies light)
const userStates = new Map<number, string>();

async function waitAndGetPhoto(ctx: Context, fileId: string) {
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) throw new Error("File path not found");
    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const res = await fetch(downloadUrl);
    return res.arrayBuffer();
}

async function uploadToTelegraph(imageBuffer: ArrayBuffer) {
  try {
    const form = new FormData();
    form.append("file", Buffer.from(imageBuffer), {
      filename: "image.jpg",
      contentType: "image/jpeg",
    });

    const response = await fetch("https://telegra.ph/upload", {
      method: "POST",
      body: form as any,
    });

    if (response.status === 200) {
      const data: any = await response.json();
      if (data && data[0] && data[0].src) {
        return `https://telegra.ph${data[0].src}`;
      }
    }
    return null;
  } catch (err) {
    console.error("Telegraph Upload Failed:", err);
    return null;
  }
}

export function setupPhotoSearch(bot: Bot) {
  bot.command("search_photo", async (ctx) => {
    await ctx.reply(
      "📸 Пожалуйста, отправьте фотографию (как сжатое фото), по которой нужно выполнить обратный поиск."
    );
    if (ctx.from?.id) {
      userStates.set(ctx.from.id, "waiting_for_photo");
    }
  });

  bot.on("message:photo", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || userStates.get(userId) !== "waiting_for_photo") {
       return; 
    }
    
    // Clear state
    userStates.delete(userId);
    
    await ctx.reply(WARNING_MSG);
    const statusMsg = await ctx.reply("⏳ Загружаю фотографию во временное хранилище (Telegraph) для генерации ссылок...");

    try {
      const photos = ctx.message.photo;
      const largestPhoto = photos[photos.length - 1]; // get highest res photo
      
      const buffer = await waitAndGetPhoto(ctx, largestPhoto.file_id);
      const publicUrl = await uploadToTelegraph(buffer);

      let text = "";
      if (publicUrl) {
        const enc = encodeURIComponent(publicUrl);
        text = `✅ <b>Фотография успешно обработана</b>\n\n` +
               `Поисковики блокируют автоматические запросы от ботов (поэтому Яндекс выдавал ошибку). Бот сгенерировал прямые ссылки, откройте их в браузере:\n\n` +
               `🔗 <a href="https://lens.google.com/uploadbyurl?url=${enc}">Поиск в Google Lens</a>\n` +
               `🔗 <a href="https://yandex.ru/images/search?rpt=imageview&url=${enc}">Поиск в Яндекс.Картинках</a>`;
      } else {
        text = "❌ К сожалению, не удалось загрузить фото для обратного поиска.";
      }

      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, text + DISCLAIMER_MSG, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });

    } catch (err: any) {
      console.error(err);
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Ошибка при обработке изображения.\nДетали: ${err.message}`);
    }
  });
}


import { Bot, Context } from "grammy";
import FormData from "form-data";

const WARNING_MSG =
  "⚠️ Бот использует только открытые источники (Google/Yandex). Продолжая, вы подтверждаете, что " +
  "имеете право искать объекты/людей на этом фото (исследование цифрового следа) и не нарушаете закон.";

const DISCLAIMER_MSG =
  "\n\nℹ️ <i>Поиск осуществляется через публичные поисковые системы алгоритмами Content-Based Image Retrieval. " +
  "Мы не храним переданные фотографии (обработка в ОЗУ).</i>";

// Simple in-memory state (instead of full FSM plugin to keep dependencies light)
const userStates = new Map<number, string>();

async function waitAndGetPhoto(ctx: Context, fileId: string) {
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) throw new Error("File path not found");
    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const res = await fetch(downloadUrl);
    return res.arrayBuffer();
}

async function searchYandex(imageBuffer: ArrayBuffer) {
  try {
    const url = "https://yandex.ru/images/search?rpt=imageview&format=json&request=%7B%22blocks%22%3A%5B%7B%22block%22%3A%22b-page_type_search-by-image__link%22%7D%5D%7D";
    
    // Create form-data payload using node-fetch/form-data rules
    const form = new FormData();
    form.append("upfile", Buffer.from(imageBuffer), {
      filename: "image.jpg",
      contentType: "image/jpeg",
    });

    const response = await fetch(url, {
      method: "POST",
      body: form as any,
      headers: {
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    if (response.status === 200) {
      const data: any = await response.json();
      const blocks = data?.blocks || [];
      const params = blocks[0]?.params || {};
      const cbirId = params?.url;

      if (cbirId) {
        return `https://yandex.ru/images/search?rpt=imageview&url=${cbirId}`;
      }
    }
    return null;
  } catch (err) {
    console.error("Yandex Request Failed:", err);
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
    const statusMsg = await ctx.reply("⏳ Загружаю фотографию в оперативную память и отправляю запрос в поисковик...");

    try {
      const photos = ctx.message.photo;
      const largestPhoto = photos[photos.length - 1]; // get highest res photo
      
      const buffer = await waitAndGetPhoto(ctx, largestPhoto.file_id);
      const searchUrl = await searchYandex(buffer);

      let text = "";
      if (searchUrl) {
        text = `✅ <b>Обратный поиск по изображению завершен</b>\n\n` +
               `Ссылка на результаты в Яндекс.Картинках (найденные лица, веб-страницы, совпадения):\n` +
               `🔗 <a href='${searchUrl}'>Перейти к результатам поиска</a>\n\n` +
               `<i>Рекомендуется открыть ссылку с браузера для детального анализа найденных страниц.</i>`;
      } else {
        text = "❌ К сожалению, поисковик отклонил запрос или не вернул результатов.";
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

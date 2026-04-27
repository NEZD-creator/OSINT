import io
import json
import logging
import aiohttp
from aiogram import Router, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

router = Router()
logger = logging.getLogger(__name__)

class PhotoSearchState(StatesGroup):
    waiting_for_photo = State()

WARNING_MSG = (
    "⚠️ Бот использует только открытые источники (Google/Yandex). Продолжая, вы подтверждаете, что "
    "имеете право искать объекты/людей на этом фото (исследование цифрового следа) и не нарушаете закон."
)

DISCLAIMER_MSG = (
    "\n\nℹ️ <i>Поиск осуществляется через публичные поисковые системы алгоритмами Content-Based Image Retrieval. "
    "Мы не храним переданные фотографии (обработка в ОЗУ).</i>"
)

@router.message(Command(commands=["search_photo"]))
async def search_photo_start(message: types.Message, state: FSMContext):
    await message.answer("📸 Пожалуйста, отправьте фотографию (как сжатое фото или документ), по которой нужно выполнить обратный поиск.")
    await state.set_state(PhotoSearchState.waiting_for_photo)
    
@router.message(PhotoSearchState.waiting_for_photo, F.photo)
async def process_photo(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer(WARNING_MSG)
    
    status_msg = await message.answer("⏳ Загружаю фотографию в оперативную память и отправляю запрос в поисковик...")
    
    try:
        # Берем фото максимального разрешения и сохраняем в ОЗУ
        photo = message.photo[-1]
        photo_bytes_io = await message.bot.download(photo, destination=io.BytesIO())
        photo_bytes = photo_bytes_io.read()
        
        # Выполняем публичный обратный поиск
        search_url = await _yandex_image_search(photo_bytes)
        
        if search_url:
            text = (
                f"✅ <b>Обратный поиск по изображению завершен</b>\n\n"
                f"Ссылка на результаты в Яндекс.Картинках (найденные лица, веб-страницы, совпадения):\n"
                f"🔗 <a href='{search_url}'>Перейти к результатам поиска</a>\n\n"
                f"<i>Рекомендуется открыть ссылку с браузера для детального анализа найденных страниц.</i>"
            )
        else:
            text = "❌ К сожалению, поисковик отклонил запрос или не вернул результатов."
            
        await status_msg.edit_text(text + DISCLAIMER_MSG, parse_mode="HTML", disable_web_page_preview=True)

    except Exception as e:
        logger.error(f"Error processing photo: {e}")
        await status_msg.edit_text(f"❌ Ошибка при обработке изображения.\nДетали: {e}")

async def _yandex_image_search(image_bytes: bytes) -> str | None:
    """
    Отправляет изображение в Yandex Images (поиск по картинке)
    через публичный HTTP endpoint CBIR (Content-Based Image Retrieval).
    """
    try:
        url = (
            "https://yandex.ru/images/search?"
            "rpt=imageview&format=json&request"
            "=%7B%22blocks%22%3A%5B%7B%22block%22%3A%22b-page_type_search-by-image__link%22%7D%5D%7D"
        )
        
        form = aiohttp.FormData()
        form.add_field('upfile', image_bytes, filename='image.jpg', content_type='image/jpeg')
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.post(url, data=form, timeout=15) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Извлекаем CBIR-идентификатор загруженной картинки для получения ссылки на результаты
                    params = data.get("blocks", [{}])[0].get("params", {})
                    cbir_id = params.get("url")
                    
                    if cbir_id:
                        return f"https://yandex.ru/images/search?rpt=imageview&url={cbir_id}"
                
                logger.warning(f"Yandex ответил статусом: {resp.status}")
                return None
    except Exception as e:
        logger.error(f"Yandex request failed: {e}")
        return None

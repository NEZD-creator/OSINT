import asyncio
import aiohttp
from bs4 import BeautifulSoup
from aiogram import Router, types
from aiogram.filters import Command

router = Router()

WARNING_MSG = (
    "⚠️ Бот использует только открытые источники. Продолжая, вы подтверждаете, что "
    "имеете право искать информацию об этом человеке (исследование собственного "
    "цифрового следа, журналистское расследование и т.п.) и не нарушаете закон."
)

DISCLAIMER_MSG = (
    "\n\nℹ️ <i>Данные взяты из открытых источников. Если вы владелец данных и "
    "хотите удалить информацию, обратитесь к администратору соответствующего сайта.</i>"
)

# Список популярных публичных площадок
# Используются те, которые возвращают 404, если профиль не существует.
SITES = [
    {"name": "GitHub", "url": "https://github.com/{}"},
    {"name": "Telegram", "url": "https://t.me/{}"},
    {"name": "Reddit", "url": "https://www.reddit.com/user/{}"},
    {"name": "Habr", "url": "https://habr.com/ru/users/{}/"},
    {"name": "SoundCloud", "url": "https://soundcloud.com/{}"},
    {"name": "Vimeo", "url": "https://vimeo.com/{}"},
    {"name": "Patreon", "url": "https://www.patreon.com/{}"},
    {"name": "Twitch", "url": "https://www.twitch.tv/{}"},
    {"name": "VK", "url": "https://vk.com/{}"},
    {"name": "Dev.to", "url": "https://dev.to/{}"},
    {"name": "Dribbble", "url": "https://dribbble.com/{}"},
    {"name": "Behance", "url": "https://www.behance.net/{}"},
    {"name": "Flickr", "url": "https://www.flickr.com/photos/{}/"},
    {"name": "Medium", "url": "https://medium.com/@{}"},
    {"name": "Keybase", "url": "https://keybase.io/{}"}
]

@router.message(Command(commands=["search_nick"]))
async def search_nick(message: types.Message):
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Использование: `/search_nick <никнейм>`", parse_mode="Markdown")
        return

    nickname = args[1].strip()
    await message.answer(WARNING_MSG)
    
    status_msg = await message.answer(f"⏳ Ищу данные открытого профиля: <b>{nickname}</b>...\nОценка времени: ~{len(SITES)} сек.", parse_mode="HTML")

    results = []
    # Эмулируем обычный браузер
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8"
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        for site in SITES:
            url = site["url"].format(nickname)
            try:
                # Ограничиваем таймаут, чтобы не зависать
                async with session.get(url, timeout=5, allow_redirects=True) as response:
                    # Некоторые сайты возвращают 200 даже если профиль отсутствует, 
                    # полагаемся на 200 и анализ заголовка.
                    if response.status == 200:
                        text = await response.text()
                        soup = BeautifulSoup(text, "html.parser")
                        title = soup.title.string.strip() if soup.title else "Без заголовка"
                        
                        lower_title = title.lower()
                        # Базовая фильтрация ложно-положительных срабатываний (soft 404)
                        not_found_markers = ["not found", "404", "такой страницы нет", "ошибка", "page does not exist", "suspended"]
                        if any(marker in lower_title for marker in not_found_markers):
                            continue
                            
                        results.append(f"✅ <b>{site['name']}</b>\n   🔗 <a href='{url}'>{url}</a>\n   📝 <i>{title}</i>")
            except Exception:
                # Пропускаем ошибки таймаута и соединения
                pass
            
            # Задержка 1 секунда (этика парсинга)
            await asyncio.sleep(1)

    if results:
        response_text = f"<b>🔎 Найденные упоминания ({len(results)}):</b>\n\n" + "\n\n".join(results)
    else:
        response_text = "🤷‍♂️ Профили не найдены или закрыты настройками приватности."

    # Отправляем итоговый ответ
    await status_msg.edit_text(
        text=response_text + DISCLAIMER_MSG,
        disable_web_page_preview=True,
        parse_mode="HTML"
    )

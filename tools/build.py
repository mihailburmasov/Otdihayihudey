"""Сборка сайта «Отдыхай и Худей»: src/ + data/company.json -> dist/.

  python tools/build.py          стейджинг: todo видны плашками, noindex
  python tools/build.py --prod   продакшен: падает, пока есть todo/draft

Синтаксис шаблонов (src/*.html):
  {{key}}               значение из company.json (todo -> плашка, draft -> пометка)
  {{key|raw}}           голое значение для атрибутов (todo -> пусто)
  {{#if key}}...{{/if}} блок выводится, только если key известен
  {{#ifnot key}}...{{/ifnot}}  наоборот
  data-draft            атрибут на тексте, который написала студия без подтверждения
"""
import html
import json
import re
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DIST = ROOT / "src", ROOT / "dist"
PAGES = {"index.html": "/", "politika-konfidentsialnosti.html": "/politika-konfidentsialnosti.html", "404.html": None}

PROD = "--prod" in sys.argv
facts = json.loads((ROOT / "data/company.json").read_text(encoding="utf-8"))
problems = []


def state(key):
    v = facts.get(key)
    if isinstance(v, dict) and "todo" in v:
        return "todo", v["todo"]
    if isinstance(v, dict) and "draft" in v:
        return "draft", v["draft"]
    return "ok", v


def known(key):
    return state(key)[0] != "todo"


def raw(key):
    s, v = state(key)
    return "" if s == "todo" else v


for k in facts:
    s, v = state(k)
    if s != "ok":
        problems.append(f"{s:5}  {k}: {v}")

site_url = raw("site_url") or facts["staging_url"]
site_url = site_url.rstrip("/")
ver = time.strftime("%Y%m%d%H%M")


def render_value(key):
    s, v = state(key)
    if s == "todo":
        return f'<span class="todo">{html.escape(v)} — нужно от клиента</span>'
    if s == "draft":
        return f'<span class="draft-fact" title="Черновик — подтвердить у клиента">{html.escape(str(v))}</span>'
    return html.escape(str(v))


def jsonld():
    biz = {
        "@context": "https://schema.org",
        "@type": ["DaySpa", "SportsActivityLocation"],
        "@id": site_url + "/#org",
        "name": facts["name"],
        "description": facts["tagline"] + ": спа-ритуалы, йога, пилатес и медитации в Москве.",
        "url": site_url + "/",
        "telephone": facts["phone_href"],
        "image": site_url + "/media/og.jpg",
        "logo": site_url + "/img/logo.svg",
        "areaServed": facts["city"],
    }
    if known("address_street"):
        biz["address"] = {"@type": "PostalAddress", "streetAddress": raw("address_street"),
                          "addressLocality": "Москва", "addressCountry": "RU"}
    if known("geo"):
        lat, lon = raw("geo")
        biz["geo"] = {"@type": "GeoCoordinates", "latitude": lat, "longitude": lon}
    if known("email"):
        biz["email"] = raw("email")
    same = [raw(k) for k in ("instagram",) if known(k)]
    if same:
        biz["sameAs"] = same
    return biz


def faq_jsonld(page_html):
    items = re.findall(r'<details class="faq__item"[^>]*>\s*<summary>(.*?)</summary>\s*<div class="faq__a">(.*?)</div>', page_html, re.S)
    strip = lambda t: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t)).strip()
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": strip(q), "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in items]}


def render(text, path):
    def cond(m):
        neg, key, body = m.group(1) == "ifnot", m.group(2), m.group(3)
        return body if known(key) != neg else ""
    for _ in range(3):
        text = re.sub(r"\{\{#(if|ifnot) (\w+)\}\}(.*?)\{\{/\1\}\}", cond, text, flags=re.S)
    text = re.sub(r"\{\{(\w+)\|raw\}\}", lambda m: html.escape(str(raw(m.group(1)))), text)
    # ссылка записи: пока YCLIENTS нет — #book открывает окно с записью по телефону
    text = re.sub(r"\{\{(\w+)\|url\}\}", lambda m: html.escape(str(raw(m.group(1)))) or "#book", text)
    canonical = site_url + (path or "/404.html")
    host = re.sub(r"^https?://", "", raw("site_url")).strip("/") if known("site_url") else "otdihayihudey"
    geo = raw("geo")
    map_url = f"https://yandex.ru/maps/?pt={geo[1]},{geo[0]}&amp;z=17&amp;l=map" if geo else ""
    builtins = {"map_url": map_url, "site_url": site_url, "canonical": canonical, "ver": ver, "year": time.strftime("%Y"),
                "robots": "index, follow" if PROD else "noindex, nofollow", "utm_campaign": host}
    text = re.sub(r"\{\{(map_url|site_url|canonical|ver|year|robots|utm_campaign)\}\}", lambda m: builtins[m.group(1)], text)
    text = re.sub(r"\{\{(\w+)\}\}", lambda m: render_value(m.group(1)) if m.group(1) in facts else m.group(0), text)
    if "{{jsonld}}" in text:
        blocks = [jsonld()]
        if 'class="faq__item"' in text:
            blocks.append(faq_jsonld(text))
        if path and path != "/":
            blocks.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Главная", "item": site_url + "/"},
                {"@type": "ListItem", "position": 2, "name": re.search(r"<h1[^>]*>(.*?)</h1>", text, re.S).group(1).strip(), "item": canonical}]})
        text = text.replace("{{jsonld}}", "\n".join(
            f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False)}</script>' for b in blocks))
    left = re.findall(r"\{\{[^}]+\}\}", text)
    if left:
        sys.exit(f"Неизвестные плейсхолдеры в {path}: {set(left)}")
    n = text.count("data-draft")
    s = text.count("data-stock")
    if s:
        problems.append(f"stock  {s} стоковых видео (data-stock) на {path or '404'} — заменить на реальные съёмки")
    if n:
        problems.append(f"draft  {n} черновых текстовых блоков (data-draft) на {path or '404'}")
    if PROD:
        text = re.sub(r"<!--(?!\[if).*?-->", "", text, flags=re.S)
    return text


DIST.mkdir(exist_ok=True)
for p in DIST.iterdir():  # чистим содержимое, а не саму папку: её может держать локальный сервер
    shutil.rmtree(p) if p.is_dir() else p.unlink()
for d in ("css", "js", "img", "media", "fonts"):
    shutil.copytree(SRC / d, DIST / d)
for name, path in PAGES.items():
    (DIST / name).write_text(render((SRC / name).read_text(encoding="utf-8"), path), encoding="utf-8")

(DIST / "robots.txt").write_text(
    ("User-agent: *\nAllow: /\n\n" if PROD else "User-agent: *\nDisallow: /\n\n") + f"Sitemap: {site_url}/sitemap.xml\n", encoding="utf-8")
urls = "".join(f"  <url><loc>{site_url}{p}</loc></url>\n" for p in PAGES.values() if p)
(DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n', encoding="utf-8")
llms = [f"# {facts['name']}", "", f"> {facts['tagline']} в Москве: спа-ритуалы, йога, пилатес и медитации. Запись онлайн через YCLIENTS и по телефону {facts['phone']}.", "",
        "## Разделы", f"- [Спа-ритуалы]({site_url}/#spa)", f"- [Зал: йога, пилатес, медитации]({site_url}/#hall)",
        f"- [Подарочные сертификаты]({site_url}/#gift)", f"- [Вопросы и ответы]({site_url}/#faq)", f"- [Контакты]({site_url}/#contacts)", "",
        "## Контакты", f"- Телефон: {facts['phone']}"]
if known("address"):
    llms.append(f"- Адрес: {raw('address')}")
(DIST / "llms.txt").write_text("\n".join(llms) + "\n", encoding="utf-8")

print(f"Собрано в {DIST} ({'prod' if PROD else 'staging'}), версия {ver}")
if problems:
    print("\nНужно от клиента / подтвердить:")
    print("\n".join("  " + p for p in problems))
    if PROD:
        sys.exit("\nПродакшен-сборка остановлена: остались todo/draft.")

# GeoMarket

Jednostránková aplikace pro tržiště geodat. Veškerá logika je nyní v `index.html` a `app.js` – vyhledávání, nahrávání a prohlížení vrstev běží v jednom rozhraní.

## Struktura
- `index.html` – jediná stránka obsahující tři sekce: **Domů** (vyhledávání a seznam balíčků), **Nahrát** (formular pro přidání vlastního balíčku) a **Mapa** (zobrazení vrstvy v novém okně).
- `style.css` – moderní a čistý design
- `app.js` – veškerý sdílený JavaScript (Supabase, ovládání sekcí, komunikace s databází/storage, Leaflet)

> původní `product.html` a `upload.html` byly sloučeny do jediné `index.html` a nyní nejsou potřeba

## Supabase (databáze a storage)
1. Vytvořte projekt na [supabase.com](https://supabase.com).
2. Vytvořte bucket `packages` ve storage, ve výchozím nastavení musí být veřejný nebo musíte generovat veřejné URL.
3. V databázi založte tabulku `packages` s alespoň následujícími sloupci:
   - `id` (serial / primary key)
   - `title` text
   - `description` text
   - `price` numeric (nebo double)
   - `tags` text (např. čárkou oddělené)
   - `file_url` text
   - (volitelně `created_at` timestamp)
4. Zkopírujte adresu projektu a `anon` klíč do `app.js`:
   ```js
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

> **CORS / povolené domény**
> Supabase má v nastavení API seznam povolených původů (origins). Pokud budete stránku spouštět na GitHub Pages nebo jiné vlastní doméně, musíte tam přidat danou adresu, jinak budou prohlížečové požadavky blokované.
> 1. Přihlaste se do svého Supabase dashboardu.
> 2. V projektu přejděte do **Settings → API → Project Configuration**.
> 3. Najděte pole **Allowed CORS Origins** nebo **Additional allowed origins**.
> 4. Vložte tam URL, odkud budete aplikaci používat, např. `https://vas-user.github.io` nebo `http://localhost:5500` pro lokální test.
> 5. Uložte změny.
> 
> Po této konfiguraci bude stránka moct z vašeho prohlížeče komunikovat s rozhraním Supabase (např. pro upload souborů nebo čtení tabulky).

### Podporované formáty a preview
Aplikace nyní obsahuje **dropzone** pro přetažení souboru (nebo kliknutím výběr) v sekci **Nahrát**. Po vložení se soubor okamžitě vykreslí v levé části náhledu pomocí Leafletu; v pravém panelu (`#park-info-panel`) jsou zobrazeny metadata (název, počet prvků, formát).
Podporované formáty:
- **GeoJSON** (resp. `.geojson`, `.json`)
- **KML** (pomocí `leaflet-omnivore`)
- **ZIP** obsahující shapefile (pomocí `shpjs` / `leaflet-shpfile`)

Mapa se automaticky přiblíží tak, aby data vyplnila 50 % plošně a kolem nich byla 25 % mezera (padding).

## Používání
1. Na „Domů“ vyhledávejte podle názvu nebo tagů; výsledky se zobrazí jako karty.
2. Kliknutím na tlačítko **Zobrazit** se otevře nové okno s Leaflet mapou a nahranou vrstvou (aktuálně podporovány pouze GeoJSON soubory).
3. V sekci **Nahrát** obchodník vloží název, popis, cenu, tagy a soubor. Soubor je automaticky nahrán do Supabase storage a metadata se uloží do tabulky.

## Další kroky / vylepšení
- Autentizace uživatelů (Registrace/Přihlášení) – Supabase auth je již načten, stačí doplnit flow.
- Filtrace na straně serveru místo klienta pro velké databáze.
- Podpora dalších formátů vrstev (např. ZIP shapefile – rozbalení na serveru).
- Platební integrace pro placené balíčky.
- Validace a bezpečnost – kontrola typů souborů, velikosti atd.

> Tento readme nyní popisuje aktuální jednopage strukturu a potřebné kroky pro připojení k databázi.
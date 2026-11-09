# Auto-investeringen

Eenvoudige website om bij te houden hoeveel geld er bij Roy (de autohandel) staat, en hoeveel daarvan in auto's zit en hoeveel cash is:

- **Geld storten / opnemen**: je eigen inleg bij Roy (of geld dat je terugneemt).
- **Auto gekocht**: het aankoopbedrag gaat van de cash af en telt mee als waarde in auto's.
- **Verkocht**: vul de verkoopdatum in. Is je deel van de winst nog niet bekend, laat het leeg; de auto blijft dan meetellen voor zijn aankoopbedrag.
- **Winst invullen**: zodra je deel van de winst bekend is, komt *aankoopbedrag + winst mijn deel* terug als cash.

Het dashboard laat altijd zien:

| Wat | Berekening |
|---|---|
| Cash bij Roy | stortingen − opnames − aankopen + (aankoop + winst) van afgerekende auto's |
| Waarde in auto's | aankoopbedrag van auto's die nog niet afgerekend zijn |
| Geld bij Roy | cash + waarde in auto's (= gestort + winst) |
| Winst (mijn deel) | som van je winstdeel van afgerekende auto's |

De naam "Roy" staat in `config.js` (`PARTNER_NAAM`).

Gebouwd met gewone HTML/CSS/JavaScript (geen build-stap nodig), **Supabase** voor database en inloggen, en **GitHub Pages** voor hosting.

---

## 1. Supabase instellen

1. Maak een gratis account op [supabase.com](https://supabase.com) en klik **New project**.
2. Ga naar **SQL Editor → New query**, plak de inhoud van [`supabase/schema.sql`](supabase/schema.sql) en klik **Run**.
3. Ga naar **Authentication → Users → Add user → Create new user**. Vul je e-mail en een wachtwoord in en vink **Auto Confirm User** aan. Dit is je login voor de website.
4. Zet openbare registratie uit: **Authentication → Sign In / Providers → Email** → zet **Allow new users to sign up** uit. Dan kan niemand anders een account maken.
5. Kopieer de **Project URL** (Project Settings → Data API, of de knop **Connect** bovenaan) en de **publishable** key (Project Settings → API Keys, begint met `sb_publishable_`).
6. Plak die twee in [`config.js`](config.js):

   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

   De anon key mag openbaar zijn; alleen ingelogde gebruikers kunnen hun eigen gegevens zien (Row Level Security staat aan). Gebruik **nooit** de `service_role` key in deze site.

7. Wil je je bestaande spreadsheet-gegevens erin? Open [`supabase/seed.sql`](supabase/seed.sql), vervang `JOUW-EMAIL` (2×) door het e-mailadres uit stap 3, en draai het **één keer** in de SQL Editor.

Zolang `config.js` leeg is draait de site in **demo-modus**: alles wordt dan alleen in je eigen browser opgeslagen.

## 2. Op GitHub zetten

1. Maak op [github.com/new](https://github.com/new) een nieuwe repository, bijv. `auto-investeringen` (mag privé of openbaar).
2. In deze map:

   ```bash
   git init
   git add .
   git commit -m "Eerste versie"
   git branch -M main
   git remote add origin https://github.com/JOUW-NAAM/auto-investeringen.git
   git push -u origin main
   ```

3. Op GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
   Na een minuut staat de site op `https://JOUW-NAAM.github.io/auto-investeringen/`.

> GitHub Pages op een privé-repository vereist een betaald GitHub-abonnement. Met een openbare repository is de code zichtbaar, maar je gegevens niet: die staan in Supabase achter je login.

## Lokaal testen

```bash
npx http-server . -p 8124
```

Open daarna http://localhost:8124.

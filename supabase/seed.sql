-- Startgegevens uit de spreadsheet. Draai dit ÉÉN keer, na schema.sql en nadat je gebruiker bestaat.
-- Vervang hieronder JOUW-EMAIL door het e-mailadres van je Supabase-gebruiker.

with me as (select id from auth.users where email = 'JOUW-EMAIL')
insert into public.cash_movements (user_id, datum, soort, bedrag, omschrijving)
select me.id, v.datum::date, 'storting', v.bedrag, v.omschrijving
from me, (values
  ('2026-03-05', 15750.00, 'Inleg Rode Q3'),
  ('2026-03-15', 15500.00, 'Inleg Grijze Q3'),
  ('2026-07-30',  6094.04, 'Bijgestort voor Grijze A6')
) as v(datum, bedrag, omschrijving);

with me as (select id from auth.users where email = 'JOUW-EMAIL')
insert into public.cars (user_id, merk, model, kenteken, inruil, aankoopdatum, aankoopprijs, verkoopdatum, winst_deel, notities)
select me.id, v.merk, v.model, v.kenteken, v.inruil, v.aankoopdatum::date, v.aankoopprijs, v.verkoopdatum::date, v.winst_deel, v.notities
from me, (values
  ('Audi', 'Q3 grijs', 'KNL-83-V', 'Geen', '2026-03-15', 15500.00, '2026-07-20', 1780.96, null),
  ('Audi', 'Q3 rood',  null,       'Geen', '2026-03-05', 15750.00, '2026-07-20', 1100.20, null),
  ('Audi', 'A6 grijs', null,       'Geen', '2026-07-30', 23375.00, '2026-11-09', null,    'A6550992 · geld uit grijze Q3 + 6.094,04 gestort'),
  -- Aankoopdatum onbekend; pas hem aan via "Bewerk" op de website.
  ('Audi', 'A3 zwart', null,       null,   '2026-11-09', 13150.00, null,         null,    'betaald uit geld dat al bij Roy stond')
) as v(merk, model, kenteken, inruil, aankoopdatum, aankoopprijs, verkoopdatum, winst_deel, notities);

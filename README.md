# Amaan Home Budgeting — لائیو سیٹ اپ (GitHub + Supabase + Vercel)

ڈیٹا Supabase میں محفوظ ہوتا ہے، کوڈ GitHub پر، اور ویب سائٹ Vercel چلاتا ہے۔ فون اور لیپ ٹاپ پر ایک ہی ڈیٹا لائیو نظر آئے گا۔

## مرحلہ 1: Supabase (ڈیٹا بیس)
1. supabase.com پر اکاؤنٹ بنائیں → **New project** (نام: amaan-budget، پاس ورڈ محفوظ رکھیں، ریجن اپنے قریب کا)۔
2. بائیں مینو میں **SQL Editor → New query** کھولیں، فائل `supabase/schema.sql` کا پورا متن پیسٹ کریں اور **Run** دبائیں۔
3. **Authentication → Providers → Email**: "Allow new users to sign up" **بند** کر دیں (تاکہ کوئی اور اکاؤنٹ نہ بنا سکے)۔
4. **Authentication → Users → Add user → Create new user**: اپنی ای میل اور پاس ورڈ ڈالیں، "Auto Confirm User" آن رکھیں۔ یہی لاگ اِن آپ ایپ میں استعمال کریں گے۔
5. **Project Settings → API** سے دو چیزیں کاپی کریں: **Project URL** اور **anon public key**۔

## مرحلہ 2: config.js بھریں
`config.js` کھول کر دونوں قدریں لکھیں:
```js
window.AMAAN_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...'
};
```
(anon key عوامی ہوتی ہے؛ ڈیٹا کی حفاظت لاگ اِن اور Row Level Security کرتی ہے۔ **service_role key کبھی یہاں نہ ڈالیں۔**)

## مرحلہ 3: GitHub
1. github.com پر **New repository** (نام: amaan-home-budgeting، Private رکھیں)۔
2. اس پوری فولڈر کو اپلوڈ کریں: ریپو میں **Add file → Upload files** اور سب فائلیں ڈال کر **Commit**۔
   یا ٹرمینل سے:
```
git init && git add . && git commit -m "first"
git branch -M main
git remote add origin https://github.com/<آپ کا نام>/amaan-home-budgeting.git
git push -u origin main
```

## مرحلہ 4: Vercel
1. vercel.com پر GitHub سے لاگ اِن کریں → **Add New → Project** → اپنا ریپو **Import**۔
2. Framework: **Other**، Build command اور Output directory **خالی** چھوڑیں → **Deploy**۔
3. چند سیکنڈ میں لنک مل جائے گا (مثلاً amaan-home-budgeting.vercel.app)۔ فون پر کھول کر "Add to Home Screen" کر لیں۔

## استعمال
- پہلی بار لنک کھولیں → ای میل/پاس ورڈ سے لاگ اِن → پہلے سے موجود ایپ لاگ اِن (users) بھی ویسے ہی کام کرے گا۔
- پرانا ڈیٹا منتقل کرنا ہو تو پرانی ایپ میں **Backup** بنائیں اور نئی میں **Restore** کریں۔
- Profile میں **Sign out of cloud** سے کلاؤڈ سے لاگ آؤٹ ہوتا ہے۔
- config.js خالی ہو تو ایپ صرف اسی براؤزر میں ڈیٹا رکھتی ہے (Sync بند)۔

## ساخت
`index.html` (ایپ) · `config.js` · `supabase-adapter.js` · `vendor/supabase.js` (supabase-js 2.45.4، MIT) · `supabase/schema.sql` · `vercel.json`

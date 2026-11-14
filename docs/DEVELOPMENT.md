# Для разработчиков

Как устроен проект, как собрать его самому и как выпускать новые версии. Описание приложения для пользователей — в [README](../README.md).

- [Сайт на Cloudflare](#сайт-на-cloudflare)
- [Выпуск новой версии](#выпуск-новой-версии)
- [Ключ подписи Android](#ключ-подписи-android-один-раз)
- [Разработка](#разработка)
- [Стек и структура](#стек)
- [Формат резервной копии](#формат-резервной-копии)

## Сайт на Cloudflare

Приложение статическое: после сборки это просто файлы из папки `dist`. Маршруты работают через `#`, поэтому настраивать перенаправления не нужно.

Сейчас сайт https://subscription-payments.whiskm.workers.dev/ подключён к репозиторию через Git-интеграцию Cloudflare: каждый push в `main` собирается и выкладывается автоматически. Ниже — как развернуть его заново.

### Вариант 1: Git-интеграция Cloudflare (проще всего)

1. В панели Cloudflare: **Workers & Pages → Create → Connect to Git** (Workers или Pages), выберите этот репозиторий.
2. Настройки сборки:
   - Framework preset: `None`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Переменная окружения: `NODE_VERSION` = `22`
3. **Save and Deploy.** Каждый push в `main` будет выкладываться автоматически, а для других веток Cloudflare создаст предпросмотр.

### Вариант 2: через GitHub Actions

Workflow `.github/workflows/deploy.yml` выкладывает `main` сам, если в репозитории заданы секреты (**Settings → Secrets and variables → Actions**):

| Секрет | Где взять |
|---|---|
| `CLOUDFLARE_API_TOKEN` | My Profile → API Tokens → Create Token, шаблон «Edit Cloudflare Workers» или право `Cloudflare Pages: Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | Правая колонка на главной странице панели Cloudflare |

Имя проекта по умолчанию `subscription-payments`; другое можно задать переменной `CLOUDFLARE_PROJECT`. Проект создаётся один раз: `npx wrangler pages project create subscription-payments`. Без секретов workflow просто пропускается.

## Выпуск новой версии

Все приложения собирает GitHub Actions:

| Workflow | Когда | Что получается |
|---|---|---|
| `android.yml` | каждый push | APK в артефактах запуска |
| `desktop.yml` | каждый push | установщики Windows (`.exe`, `.msi`) и Linux (`.deb`, `.rpm`, `.AppImage`) в артефактах запуска |
| `release.yml` | тег вида `v1.2.3` | всё сразу, опубликованное одним релизом на странице **Releases** |

```bash
npm version patch          # 0.1.0 → 0.1.1: версия попадёт в Android, Windows и Linux
git push --follow-tags     # запускает release.yml
```

Тег можно создать и в браузере: **Releases → Draft a new release → Choose a tag → `v1.2.3` → Create new tag on publish → Publish release**. Если сборка или публикация не удалась, исправьте причину и запустите **Actions → Release → Run workflow** с этим тегом: файлы прикрепятся к уже созданному релизу.

### Ключ подписи Android (один раз)

Android устанавливает обновление поверх старой версии, только если обе подписаны одним ключом. Создайте его один раз и сохраните в секретах:

```bash
keytool -genkeypair -v -keystore release.jks -alias subscriptions \
  -keyalg RSA -keysize 4096 -validity 10000

base64 -w0 release.jks > release.jks.base64   # на macOS: base64 -i release.jks
```

| Секрет | Значение |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | содержимое `release.jks.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | пароль хранилища |
| `ANDROID_KEY_ALIAS` | `subscriptions` |
| `ANDROID_KEY_PASSWORD` | пароль ключа |

Храните `release.jks` и пароли в надёжном месте: без них нельзя выпустить обновление, которое встанет поверх установленного. Пока секретов нет, собирается отладочный APK.

`versionName` и `versionCode` Android, как и версия приложений для компьютера, берутся из `package.json`.

## Разработка

Нужен Node.js 22.

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # юнит-тесты: даты, расчёты, шифрование, импорт
npm run typecheck
npm run build        # веб-версия в dist/
```

Android (нужны Android Studio и JDK 21):

```bash
npm run android:sync # сборка для приложения и копирование в android/
npx cap open android # открыть в Android Studio
```

Windows и Linux (нужен [Rust](https://rustup.rs); в Linux ещё `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`):

```bash
npm run desktop:dev    # окно приложения с горячей перезагрузкой
npm run desktop:build  # установщики в src-tauri/target/release/bundle/
```

Служебные скрипты:

```bash
npm run icons                     # обновить логотипы сервисов из Simple Icons
node scripts/render-icons.mjs     # перерисовать иконки приложения из assets/*.svg
npx capacitor-assets generate --android --iconBackgroundColor '#E4572E' --splashBackgroundColor '#EBE3D3'
```

### Стек

React 19 · TypeScript · Vite · [Motion](https://motion.dev) для анимаций · Dexie (IndexedDB) · Web Crypto API · vite-plugin-pwa (Workbox) · Capacitor 8 для Android · [Tauri 2](https://tauri.app) для Windows и Linux (встроенный браузерный движок системы, поэтому установщик весит около 3 МБ). Дизайн-система своя, без готовых UI-китов: бумажные билеты с вырубкой через CSS-маски, чеки с зубчатым краем, штампы и перфорация вместо полос прогресса.

### Структура

```
src/
  lib/          логика без интерфейса: даты, расписание, расчёты, шифрование, копии, экспорт
  data/         каталог сервисов и логотипы
  i18n/         переводы: en.ts (эталон), ru.ts, zh.ts
  state/        контексты: настройки и данные, хранилище паролей, диалоги, роутер
  components/   билет, листы, элементы форм, иконки
  screens/      экраны
  styles/       дизайн-токены и стили
tests/          юнит-тесты (Vitest)
android/        проект Capacitor
src-tauri/      оболочка для Windows и Linux: трей, автозапуск, запись копий (Rust)
public/         иконки, заголовки Cloudflare
```

### Новый язык

Скопируйте `src/i18n/ru.ts`, переведите строки и подключите словарь в `src/i18n/index.ts`. TypeScript подскажет, если какой-то ключ пропущен.

### Формат резервной копии

```jsonc
{
  "app": "subscription-payments",
  "format": 1,
  "exportedAt": "2026-11-13T10:00:00.000Z",
  "encrypted": false,
  "data": {
    "subscriptions": [ /* подписки; поле credentials зашифровано AES-GCM */ ],
    "categories": [ /* категории */ ],
    "settings": { /* язык, валюта, внешний вид… */ },
    "vault": { "salt": "…", "iter": 600000, "check": { "iv": "…", "ct": "…" } }
  }
}
```

В зашифрованной копии вместо `data` лежит `payload`, зашифрованный тем же мастер-паролем. При импорте каждое поле проверяется: неизвестные значения отбрасываются, ссылки допускаются только `http(s)`.

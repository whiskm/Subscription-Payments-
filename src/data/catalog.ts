import type { Lang } from '../lib/types';

export interface Service {
  key: string;
  name: string;
  /** Localised names where the service is known under a different one. */
  ru?: string;
  zh?: string;
  /** Extra words the search should match. */
  alt?: string;
  color: string;
  cat: string;
  /** Where the subscription is managed or cancelled. */
  url?: string;
  /** Simple Icons slug; services without one get a monogram. */
  si?: string;
}

// prettier-ignore
export const SERVICES: Service[] = [
  // Video
  { key: 'netflix', name: 'Netflix', zh: '奈飞', color: '#E50914', cat: 'video', url: 'https://www.netflix.com/account', si: 'netflix' },
  { key: 'youtube', name: 'YouTube Premium', alt: 'ютуб', color: '#FF0000', cat: 'video', url: 'https://www.youtube.com/paid_memberships', si: 'youtube' },
  { key: 'disney', name: 'Disney+', alt: 'disney plus дисней', color: '#113CCF', cat: 'video', url: 'https://www.disneyplus.com/account' },
  { key: 'max', name: 'HBO Max', alt: 'hbo max', color: '#002BE7', cat: 'video', url: 'https://www.hbomax.com/account', si: 'hbomax' },
  { key: 'primevideo', name: 'Amazon Prime', alt: 'prime video амазон', zh: '亚马逊 Prime', color: '#1399FF', cat: 'video', url: 'https://www.amazon.com/mc' },
  { key: 'appletv', name: 'Apple TV+', color: '#111111', cat: 'video', url: 'https://tv.apple.com/settings', si: 'appletv' },
  { key: 'hulu', name: 'Hulu', color: '#1CE783', cat: 'video', url: 'https://secure.hulu.com/account' },
  { key: 'paramount', name: 'Paramount+', color: '#0064FF', cat: 'video', url: 'https://www.paramountplus.com/account/', si: 'paramountplus' },
  { key: 'crunchyroll', name: 'Crunchyroll', alt: 'anime аниме', color: '#F47521', cat: 'video', url: 'https://www.crunchyroll.com/account/membership', si: 'crunchyroll' },
  { key: 'twitch', name: 'Twitch', alt: 'твич turbo', color: '#9146FF', cat: 'video', url: 'https://www.twitch.tv/subscriptions', si: 'twitch' },
  { key: 'kinopoisk', name: 'Kinopoisk', ru: 'Кинопоиск', color: '#FF5500', cat: 'video', url: 'https://hd.kinopoisk.ru/', si: 'kinopoisk' },
  { key: 'yandexplus', name: 'Yandex Plus', ru: 'Яндекс Плюс', alt: 'yandex яндекс plus', color: '#FC3F1D', cat: 'video', url: 'https://plus.yandex.ru/my' },
  { key: 'ivi', name: 'ivi', ru: 'Иви', color: '#EA003D', cat: 'video', url: 'https://www.ivi.ru/profile/subscriptions' },
  { key: 'okko', name: 'Okko', ru: 'Окко', color: '#6C2BD9', cat: 'video', url: 'https://okko.tv/settings/subscriptions' },
  { key: 'wink', name: 'Wink', ru: 'Wink', alt: 'винк ростелеком', color: '#FF4F12', cat: 'video', url: 'https://wink.ru/my' },
  { key: 'start', name: 'START', ru: 'START', alt: 'старт', color: '#E8262D', cat: 'video', url: 'https://start.ru/profile' },
  { key: 'premier', name: 'PREMIER', ru: 'PREMIER', alt: 'премьер тнт', color: '#F2B600', cat: 'video', url: 'https://premier.one/profile' },
  { key: 'iqiyi', name: 'iQIYI', zh: '爱奇艺', alt: 'aiqiyi', color: '#00BE06', cat: 'video', url: 'https://vip.iqiyi.com/' },
  { key: 'tencentvideo', name: 'Tencent Video', zh: '腾讯视频', alt: 'wetv', color: '#1F8FFF', cat: 'video', url: 'https://film.qq.com/' },
  { key: 'youku', name: 'Youku', zh: '优酷', color: '#00A0E9', cat: 'video', url: 'https://vip.youku.com/' },
  { key: 'bilibili', name: 'Bilibili', zh: '哔哩哔哩大会员', alt: 'b站', color: '#00A1D6', cat: 'video', url: 'https://account.bilibili.com/account/big', si: 'bilibili' },
  { key: 'mangotv', name: 'Mango TV', zh: '芒果TV', color: '#FF5F00', cat: 'video', url: 'https://www.mgtv.com/' },

  // Music
  { key: 'spotify', name: 'Spotify', alt: 'спотифай', color: '#1DB954', cat: 'music', url: 'https://www.spotify.com/account/subscription/', si: 'spotify' },
  { key: 'applemusic', name: 'Apple Music', color: '#FA243C', cat: 'music', url: 'https://music.apple.com/account/settings', si: 'applemusic' },
  { key: 'youtubemusic', name: 'YouTube Music', color: '#FF0000', cat: 'music', url: 'https://www.youtube.com/paid_memberships', si: 'youtubemusic' },
  { key: 'yandexmusic', name: 'Yandex Music', ru: 'Яндекс Музыка', color: '#FFCC00', cat: 'music', url: 'https://music.yandex.ru/settings/account' },
  { key: 'vkmusic', name: 'VK Music', ru: 'VK Музыка', alt: 'вк вконтакте', color: '#0077FF', cat: 'music', url: 'https://vk.com/settings?act=payments', si: 'vk' },
  { key: 'zvuk', name: 'Zvuk', ru: 'Звук', alt: 'сберзвук', color: '#14B8A6', cat: 'music', url: 'https://zvuk.com/profile' },
  { key: 'tidal', name: 'TIDAL', color: '#111111', cat: 'music', url: 'https://account.tidal.com/', si: 'tidal' },
  { key: 'deezer', name: 'Deezer', color: '#A238FF', cat: 'music', url: 'https://www.deezer.com/account/subscription', si: 'deezer' },
  { key: 'soundcloud', name: 'SoundCloud Go', color: '#FF5500', cat: 'music', url: 'https://soundcloud.com/settings/subscriptions', si: 'soundcloud' },
  { key: 'neteasemusic', name: 'NetEase Cloud Music', zh: '网易云音乐', color: '#D43C33', cat: 'music', url: 'https://music.163.com/', si: 'neteasecloudmusic' },
  { key: 'qqmusic', name: 'QQ Music', zh: 'QQ音乐', color: '#31C27C', cat: 'music', url: 'https://y.qq.com/' },

  // AI
  { key: 'chatgpt', name: 'ChatGPT', alt: 'openai plus чатгпт', color: '#10A37F', cat: 'ai', url: 'https://chatgpt.com/#settings/Subscription' },
  { key: 'claude', name: 'Claude', alt: 'anthropic pro max клод', color: '#D97757', cat: 'ai', url: 'https://claude.ai/settings/billing', si: 'claude' },
  { key: 'gemini', name: 'Google AI Pro', alt: 'gemini advanced', color: '#4285F4', cat: 'ai', url: 'https://one.google.com/settings', si: 'googlegemini' },
  { key: 'copilot', name: 'GitHub Copilot', color: '#181717', cat: 'ai', url: 'https://github.com/settings/copilot', si: 'githubcopilot' },
  { key: 'cursor', name: 'Cursor', color: '#111111', cat: 'ai', url: 'https://cursor.com/settings', si: 'cursor' },
  { key: 'perplexity', name: 'Perplexity', color: '#1FB8CD', cat: 'ai', url: 'https://www.perplexity.ai/settings/account', si: 'perplexity' },
  { key: 'midjourney', name: 'Midjourney', color: '#111111', cat: 'ai', url: 'https://www.midjourney.com/account' },
  { key: 'deepl', name: 'DeepL', color: '#0F2B46', cat: 'ai', url: 'https://www.deepl.com/account/plan', si: 'deepl' },
  { key: 'grammarly', name: 'Grammarly', color: '#027E6F', cat: 'ai', url: 'https://account.grammarly.com/subscription', si: 'grammarly' },
  { key: 'yandexgpt', name: 'Alice Pro', ru: 'Алиса Про', alt: 'yandexgpt яндекс', color: '#7B4DFF', cat: 'ai', url: 'https://plus.yandex.ru/my' },
  { key: 'doubao', name: 'Doubao', zh: '豆包', color: '#3B6CFF', cat: 'ai' },

  // Work & software
  { key: 'microsoft365', name: 'Microsoft 365', alt: 'office офис', color: '#D83B01', cat: 'work', url: 'https://account.microsoft.com/services' },
  { key: 'adobe', name: 'Adobe Creative Cloud', alt: 'photoshop', color: '#DA1F26', cat: 'work', url: 'https://account.adobe.com/plans' },
  { key: 'notion', name: 'Notion', color: '#111111', cat: 'work', url: 'https://www.notion.so/my-account', si: 'notion' },
  { key: 'figma', name: 'Figma', color: '#F24E1E', cat: 'work', url: 'https://www.figma.com/settings', si: 'figma' },
  { key: 'canva', name: 'Canva', color: '#00C4CC', cat: 'work', url: 'https://www.canva.com/settings/billing-and-teams' },
  { key: 'github', name: 'GitHub', color: '#181717', cat: 'work', url: 'https://github.com/settings/billing', si: 'github' },
  { key: 'jetbrains', name: 'JetBrains', color: '#111111', cat: 'work', url: 'https://account.jetbrains.com/licenses', si: 'jetbrains' },
  { key: 'slack', name: 'Slack', color: '#4A154B', cat: 'work' },
  { key: 'zoom', name: 'Zoom', color: '#0B5CFF', cat: 'work', url: 'https://zoom.us/billing', si: 'zoom' },
  { key: 'todoist', name: 'Todoist', color: '#E44332', cat: 'work', url: 'https://app.todoist.com/app/settings/subscription', si: 'todoist' },
  { key: 'evernote', name: 'Evernote', color: '#00A82D', cat: 'work', url: 'https://www.evernote.com/Settings.action', si: 'evernote' },
  { key: 'obsidian', name: 'Obsidian Sync', color: '#7C3AED', cat: 'work', url: 'https://obsidian.md/account', si: 'obsidian' },
  { key: 'linear', name: 'Linear', color: '#5E6AD2', cat: 'work', si: 'linear' },
  { key: 'wps', name: 'WPS Office', zh: 'WPS 会员', color: '#D9281A', cat: 'work', url: 'https://vip.wps.cn/' },
  { key: 'linkedin', name: 'LinkedIn Premium', color: '#0A66C2', cat: 'work', url: 'https://www.linkedin.com/premium/manage' },
  { key: 'telegram', name: 'Telegram Premium', alt: 'телеграм', color: '#26A5E4', cat: 'work', url: 'https://telegram.org/', si: 'telegram' },
  { key: 'discord', name: 'Discord Nitro', alt: 'дискорд', color: '#5865F2', cat: 'work', url: 'https://discord.com/billing/subscriptions', si: 'discord' },
  { key: 'x', name: 'X Premium', alt: 'twitter твиттер', color: '#111111', cat: 'work', url: 'https://x.com/settings/subscriptions', si: 'x' },
  { key: 'patreon', name: 'Patreon', color: '#111111', cat: 'work', url: 'https://www.patreon.com/settings/memberships', si: 'patreon' },
  { key: 'boosty', name: 'Boosty', ru: 'Boosty', alt: 'бусти', color: '#F15F2C', cat: 'work', url: 'https://boosty.to/app/settings/subscriptions', si: 'boosty' },

  // Cloud & storage
  { key: 'icloud', name: 'iCloud+', alt: 'apple айклауд', color: '#3693F3', cat: 'cloud', url: 'https://www.icloud.com/settings/', si: 'icloud' },
  { key: 'appleone', name: 'Apple One', color: '#111111', cat: 'cloud', url: 'https://apps.apple.com/account/subscriptions', si: 'apple' },
  { key: 'googleone', name: 'Google One', alt: 'drive диск', color: '#4285F4', cat: 'cloud', url: 'https://one.google.com/settings', si: 'google' },
  { key: 'dropbox', name: 'Dropbox', color: '#0061FF', cat: 'cloud', url: 'https://www.dropbox.com/account/plan', si: 'dropbox' },
  { key: 'yandex360', name: 'Yandex 360', ru: 'Яндекс 360', alt: 'диск disk', color: '#2D7FF9', cat: 'cloud', url: 'https://360.yandex.ru/premium-plans' },
  { key: 'mailcloud', name: 'Mail.ru Cloud', ru: 'Облако Mail', alt: 'vk workspace', color: '#005FF9', cat: 'cloud', url: 'https://cloud.mail.ru/' },
  { key: 'baidunetdisk', name: 'Baidu Netdisk', zh: '百度网盘', color: '#06A7FF', cat: 'cloud', url: 'https://pan.baidu.com/', si: 'baidu' },
  { key: 'aliyundrive', name: 'Aliyun Drive', zh: '阿里云盘', color: '#637DFF', cat: 'cloud', url: 'https://www.alipan.com/' },
  { key: 'hosting', name: 'Hosting', ru: 'Хостинг', zh: '主机托管', alt: 'vps server сервер', color: '#4A6274', cat: 'cloud' },
  { key: 'domain', name: 'Domain', ru: 'Домен', zh: '域名', color: '#7C7466', cat: 'cloud' },

  // Games
  { key: 'gamepass', name: 'Xbox Game Pass', color: '#107C10', cat: 'games', url: 'https://account.microsoft.com/services' },
  { key: 'psplus', name: 'PlayStation Plus', alt: 'ps plus', color: '#0070D1', cat: 'games', url: 'https://www.playstation.com/acct/management', si: 'playstation' },
  { key: 'nintendo', name: 'Nintendo Switch Online', color: '#E60012', cat: 'games', url: 'https://accounts.nintendo.com/' },
  { key: 'eaplay', name: 'EA Play', color: '#FF4747', cat: 'games', url: 'https://myaccount.ea.com/', si: 'ea' },
  { key: 'geforcenow', name: 'GeForce NOW', color: '#76B900', cat: 'games', url: 'https://www.nvidia.com/account/gfn/', si: 'nvidia' },

  // Reading
  { key: 'kindle', name: 'Kindle Unlimited', color: '#FF9900', cat: 'reading', url: 'https://www.amazon.com/kindle-dbs/ku/ku-central' },
  { key: 'audible', name: 'Audible', color: '#F8991C', cat: 'reading', url: 'https://www.audible.com/account/overview', si: 'audible' },
  { key: 'litres', name: 'Litres', ru: 'Литрес', color: '#FF4C00', cat: 'reading', url: 'https://www.litres.ru/pages/personal_cabinet/' },
  { key: 'bookmate', name: 'Bookmate', ru: 'Яндекс Книги', alt: 'букмейт', color: '#F5A623', cat: 'reading', url: 'https://plus.yandex.ru/my' },
  { key: 'medium', name: 'Medium', color: '#111111', cat: 'reading', url: 'https://medium.com/me/settings/membership', si: 'medium' },
  { key: 'nyt', name: 'The New York Times', color: '#111111', cat: 'reading', url: 'https://myaccount.nytimes.com/seg/subscription', si: 'newyorktimes' },
  { key: 'wechatread', name: 'WeChat Read', zh: '微信读书', color: '#1AAD19', cat: 'reading', si: 'wechat' },

  // Education
  { key: 'duolingo', name: 'Duolingo', alt: 'дуолинго', zh: '多邻国', color: '#58CC02', cat: 'education', url: 'https://www.duolingo.com/settings/subscription', si: 'duolingo' },
  { key: 'coursera', name: 'Coursera', color: '#0056D2', cat: 'education', url: 'https://www.coursera.org/my-purchases', si: 'coursera' },
  { key: 'skillbox', name: 'Skillbox', ru: 'Skillbox', alt: 'скиллбокс', color: '#3D3BFF', cat: 'education' },

  // Health
  { key: 'strava', name: 'Strava', color: '#FC4C02', cat: 'health', url: 'https://www.strava.com/account', si: 'strava' },
  { key: 'headspace', name: 'Headspace', color: '#F47D31', cat: 'health', url: 'https://www.headspace.com/settings/subscription', si: 'headspace' },
  { key: 'fitness', name: 'Gym', ru: 'Фитнес-клуб', zh: '健身房', alt: 'fitness спортзал', color: '#D6457A', cat: 'health' },

  // Security
  { key: '1password', name: '1Password', color: '#3B66BC', cat: 'security', url: 'https://my.1password.com/billing', si: '1password' },
  { key: 'bitwarden', name: 'Bitwarden', color: '#175DDC', cat: 'security', url: 'https://vault.bitwarden.com/#/settings/subscription', si: 'bitwarden' },
  { key: 'proton', name: 'Proton', alt: 'protonmail vpn', color: '#6D4AFF', cat: 'security', url: 'https://account.proton.me/dashboard', si: 'proton' },
  { key: 'nordvpn', name: 'NordVPN', color: '#4687FF', cat: 'security', url: 'https://my.nordaccount.com/billing/', si: 'nordvpn' },
  { key: 'expressvpn', name: 'ExpressVPN', color: '#DA3940', cat: 'security', url: 'https://www.expressvpn.com/subscriptions', si: 'expressvpn' },
  { key: 'surfshark', name: 'Surfshark', color: '#1EBFBF', cat: 'security', url: 'https://my.surfshark.com/account/subscription', si: 'surfshark' },
  { key: 'vpn', name: 'VPN', color: '#4A6274', cat: 'security' },

  // Utilities
  { key: 'mobile', name: 'Mobile plan', ru: 'Мобильная связь', zh: '手机套餐', alt: 'мтс билайн мегафон теле2 tele2 sim', color: '#D98A00', cat: 'utilities' },
  { key: 'internet', name: 'Home internet', ru: 'Домашний интернет', zh: '宽带', alt: 'wifi провайдер', color: '#1D9BB8', cat: 'utilities' },
  { key: 'mtspremium', name: 'MTS Premium', ru: 'МТС Premium', alt: 'kion кион', color: '#E30611', cat: 'utilities', url: 'https://premium.mts.ru/' },

  // Shopping & banks
  { key: 'sberprime', name: 'SberPrime', ru: 'СберПрайм', alt: 'сбер', color: '#21A038', cat: 'shopping', url: 'https://sberprime.sber.ru/' },
  { key: 'tbankpro', name: 'T-Bank Pro', ru: 'Т-Банк Pro', alt: 'тинькофф tinkoff', color: '#FFDD2D', cat: 'shopping', url: 'https://www.tbank.ru/pro/' },
  { key: 'ozonpremium', name: 'Ozon Premium', ru: 'Ozon Premium', alt: 'озон', color: '#005BFF', cat: 'shopping', url: 'https://www.ozon.ru/my/premium' },
  { key: 'jdplus', name: 'JD Plus', zh: '京东PLUS', color: '#E1251B', cat: 'shopping', url: 'https://plus.jd.com/' },
  { key: '88vip', name: '88VIP', zh: '淘宝 88VIP', alt: 'taobao tmall', color: '#FF5000', cat: 'shopping', si: 'taobao' },
  { key: 'costco', name: 'Costco', color: '#E31837', cat: 'shopping' },
];

const byKey = new Map(SERVICES.map((s) => [s.key, s]));

export function getService(key: string | undefined): Service | undefined {
  return key ? byKey.get(key) : undefined;
}

export function serviceName(s: Service, lang: Lang): string {
  return (lang === 'ru' ? s.ru : lang === 'zh' ? s.zh : undefined) ?? s.name;
}

/** Popular picks offered on an empty home screen, per language. */
export const STARTERS: Record<Lang, string[]> = {
  ru: ['yandexplus', 'telegram', 'chatgpt', 'icloud', 'youtube', 'spotify', 'mobile', 'internet'],
  en: ['netflix', 'spotify', 'youtube', 'chatgpt', 'icloud', 'primevideo', 'disney', 'mobile'],
  zh: ['iqiyi', 'tencentvideo', 'bilibili', 'neteasemusic', 'baidunetdisk', 'icloud', 'jdplus', 'mobile'],
};

export function searchServices(query: string, lang: Lang, limit = 6): Service[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<[number, Service]> = [];
  for (const s of SERVICES) {
    const names = [s.name, s.ru, s.zh].filter(Boolean).map((n) => n!.toLowerCase());
    let score = 0;
    if (names.some((n) => n.startsWith(q))) score = 3;
    else if (names.some((n) => n.includes(q))) score = 2;
    else if (s.alt?.toLowerCase().includes(q) || s.key.includes(q)) score = 1;
    if (score) scored.push([score + (serviceName(s, lang).toLowerCase().startsWith(q) ? 1 : 0), s]);
  }
  return scored
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, s]) => s);
}

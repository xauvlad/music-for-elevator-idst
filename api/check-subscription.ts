import crypto from 'crypto';

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function validateInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    return { ok: false as const, reason: 'Missing hash' };
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return { ok: false as const, reason: 'Invalid hash' };
  }

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!authDate || now - authDate > 3600) {
    return { ok: false as const, reason: 'Expired initData' };
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    return { ok: false as const, reason: 'Missing user' };
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return { ok: false as const, reason: 'Invalid user payload' };
  }

  return { ok: true as const, user };
}

async function getChatMember(botToken: string, chatId: string, userId: number) {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(
    chatId,
  )}&user_id=${userId}`;

  const response = await fetch(url);
  const data = await response.json();
  return data;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const botToken = process.env.BOT_TOKEN;
  const channelUsername = process.env.CHANNEL_USERNAME;

  if (!botToken || !channelUsername) {
    return res.status(500).json({ ok: false, error: 'Missing server env vars' });
  }

  const { initData } = req.body || {};

  if (!initData || typeof initData !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing initData' });
  }

  const validated = validateInitData(initData, botToken);

  if (!validated.ok) {
    return res.status(401).json({ ok: false, error: validated.reason });
  }

  const memberData = await getChatMember(botToken, channelUsername, validated.user.id);

  if (!memberData?.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Failed to check subscription',
      details: memberData,
    });
  }

  const status = memberData.result?.status;
  const isSubscribed =
    status === 'creator' || status === 'administrator' || status === 'member';

  return res.status(200).json({
    ok: true,
    isSubscribed,
    status,
    user: validated.user,
  });
}

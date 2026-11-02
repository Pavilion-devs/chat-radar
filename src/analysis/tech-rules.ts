export const TECH_LABELS = {
  audio_muted: "Chat says you’re muted",
  game_audio_loud: 'Game audio is too loud',
  frozen_lag: 'Stream is frozen or lagging',
  black_screen: 'Chat sees a black screen',
  wrong_scene: 'Wrong scene is showing',
  mic_peaking: 'Microphone is peaking or distorted',
} as const;
export type TechCategory = keyof typeof TECH_LABELS;
const rules: Record<TechCategory, { report: RegExp[]; resolved: RegExp }> = {
  audio_muted: {
    report:[/\b(no (audio|sound)|(?:can ?not|cant) hear (you|u|your mic)|(?:you(?:re)?|ur|mic|microphone|stream) (?:is |are )?mu+te+d+|sin (audio|sonido)|sem (audio|som)|microfono (?:esta )?(?:silenciado|mutado))\b/,/^(?:mu+te+d+|unmute(?: your mic)?)$/, /音が(?:出ない|聞こえない)|ミュート|لا يوجد صوت|الصوت مقطوع/],
    resolved:/\b(not muted|(?:audio|sound|mic) (?:is )?(?:fine|fixed|working|back)|(?:can|could) hear (?:you|u)|no (?:longer )?audio (?:issues|problems))\b/,
  },
  game_audio_loud: {
    report:[/\b(?:(?:game|music|desktop) (?:audio |sound )?(?:is |too )*(?:loud|deafening)|turn (?:the )?(?:game|music) down|(?:juego|jogo|musica) (?:esta )?(?:muy |muito )?alto)\b/,/ゲーム音が大きい|صوت اللعبة مرتفع/],
    resolved:/\b(?:(?:game|music) (?:audio )?(?:is )?not (?:too )?loud|(?:game|music) (?:audio )?(?:is )?(?:fine|fixed|balanced))\b/,
  },
  frozen_lag: {
    report:[/\b(?:(?:stream|video) (?:is |keeps )?(?:frozen|freezing|lag+ing|buffering|stuck)|(?:stream|video) lag+|(?:la )?(?:transmision|stream) (?:esta )?(?:congelad[ao]|travando)|tela travada)\b/,/^(?:lag+|lag+ing|frozen|buffering)$/, /配信が止ま|映像が止ま|البث متجمد|البث يقطع/],
    resolved:/\b(no lag+|not (?:frozen|lag+ing)|(?:stream|video) (?:is )?(?:fine|fixed|smooth))\b/,
  },
  black_screen: {
    report:[/\b(?:black screen|screen (?:is |went )?black|pantalla negra|tela preta)\b/,/画面が真っ黒|画面が黒い|شاشة سوداء/],
    resolved:/\b(no (?:more )?black screen|screen (?:is )?not black|(?:screen|video) (?:is )?(?:back|fixed|working))\b/,
  },
  wrong_scene: {
    report:[/\b(?:wrong scene|switch (?:the |your )?scene|still (?:on |showing )?(?:the )?(?:starting|brb|ending) (?:screen|scene)|escena equivocada|cena errada)\b/,/シーンが違う|المشهد الخطا/],
    resolved:/\b(not (?:the )?wrong scene|(?:scene|screen) (?:is )?(?:correct|fixed)|right scene now)\b/,
  },
  mic_peaking: {
    report:[/\b(?:(?:mic|microphone) (?:is |keeps )?(?:peaking|clipping|crackling|distorted|distorting)|(?:microfono|microfone) (?:esta )?(?:saturando|estourando|distorcido))\b/,/マイクが音割れ|音割れしてる|صوت الميكروفون مشوه/],
    resolved:/\b((?:mic|microphone) (?:is )?not (?:peaking|clipping|distorted)|(?:mic|microphone) (?:is )?(?:fine|fixed|clear))\b/,
  },
};
export function matchTechProblems(input:string): TechCategory[] {
  const text=input.slice(0,2000).normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f]/g,'').normalize('NFC').toLowerCase()
    .replace(/[’']/g,'').replace(/(.)\1{2,}/gu,'$1$1').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  return (Object.keys(rules) as TechCategory[]).filter(category=>{
    const rule=rules[category];return !rule.resolved.test(text) && rule.report.some(pattern=>pattern.test(text));
  });
}

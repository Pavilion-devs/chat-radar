export function commandNoise(text:string):boolean {
  return text.trimStart().startsWith('!') || /^@[a-z0-9_]+\s+(?:Radar|Recap):/i.test(text);
}

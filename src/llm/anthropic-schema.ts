// Anthropic rejects numeric/length/array bounds. Keep them in field descriptions;
// the application still validates the complete original schema after generation.
const DESCRIBED=new Set(['minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','pattern','minItems','maxItems']);
export function anthropicSchema(schema:Record<string,unknown>):Record<string,unknown> {
  const result:Record<string,unknown>={};const constraints:string[]=[];
  for (const [key,value] of Object.entries(schema)) {
    if (DESCRIBED.has(key)) {constraints.push(`${key}: ${JSON.stringify(value)}`);continue;}
    if (key==='properties' || key==='$defs' || key==='definitions') {
      result[key]=Object.fromEntries(Object.entries(value as Record<string,Record<string,unknown>>).map(([name,child])=>[name,anthropicSchema(child)]));
    } else if (key==='items') result[key]=anthropicSchema(value as Record<string,unknown>);
    else if (['anyOf','allOf','oneOf'].includes(key)) result[key]=(value as Record<string,unknown>[]).map(anthropicSchema);
    else result[key]=structuredClone(value);
  }
  if (constraints.length) result.description=[result.description,`Constraints enforced by the application: ${constraints.join('; ')}`].filter(Boolean).join('. ');
  return result;
}
